const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { adminAuth } = require('../middleware/auth');
const { validateFlight, validateOrderStatus } = require('../middleware/validate');
const supabase = require('../db-supabase');

const router = express.Router();

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Helper to convert flight row to camelCase
function toFlight(row) {
  if (!row) return null;
  return {
    id: row.id,
    flightNo: row.flight_no,
    airline: row.airline,
    departure: row.departure,
    arrival: row.arrival,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    price: parseFloat(row.price),
    totalSeats: row.total_seats,
    availableSeats: row.available_seats,
    aircraft: row.aircraft,
    status: row.status,
    createdAt: row.created_at
  };
}

// Helper to convert order row to camelCase
function toOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    flightId: row.flight_id,
    flightNo: row.flight_no,
    airline: row.airline,
    departure: row.departure,
    arrival: row.arrival,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    passengers: row.passengers,
    totalPrice: parseFloat(row.total_price),
    unitPrice: parseFloat(row.unit_price),
    status: row.status,
    refundReason: row.refund_reason,
    refundRequestedAt: row.refund_requested_at,
    createdAt: row.created_at
  };
}

// === Dashboard stats ===
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [usersResult, flightsResult, ordersResult] = await Promise.all([
      supabase.from('users').select('role', { count: 'exact', head: true }).neq('role', 'admin'),
      supabase.from('flights').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('status, total_price')
    ]);

    const orders = ordersResult.data || [];
    const activeOrders = orders.filter(o => o.status === 'paid');
    const totalRevenue = activeOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);

    res.json({
      totalUsers: usersResult.count || 0,
      totalFlights: flightsResult.count || 0,
      totalOrders: orders.length,
      totalRevenue,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
      pendingRefunds: orders.filter(o => o.status === 'refund_pending').length
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: '获取统计失败' });
  }
});

// === Flight management ===
router.get('/flights', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data.map(toFlight));
  } catch (err) {
    console.error('Get flights error:', err);
    res.status(500).json({ message: '获取航班列表失败' });
  }
});

router.post('/flights', adminAuth, validateFlight, async (req, res) => {
  try {
    const { flightNo, airline, departure, arrival, departureTime, arrivalTime, price, totalSeats, aircraft, status } = req.body;

    const flight = {
      id: 'F' + uuidv4().slice(0, 6).toUpperCase(),
      flight_no: sanitize(flightNo.trim()),
      airline: sanitize(airline.trim()),
      departure: sanitize(departure.trim()),
      arrival: sanitize(arrival.trim()),
      departure_time: departureTime,
      arrival_time: arrivalTime,
      price,
      total_seats: totalSeats,
      available_seats: totalSeats,
      aircraft: sanitize(aircraft.trim()),
      status: status || 'on-time'
    };

    const { data, error } = await supabase
      .from('flights')
      .insert([flight])
      .select()
      .single();

    if (error) throw error;
    res.json({ message: '添加成功', flight: toFlight(data) });
  } catch (err) {
    console.error('Add flight error:', err);
    res.status(500).json({ message: '添加航班失败' });
  }
});

router.put('/flights/:id', adminAuth, validateFlight, async (req, res) => {
  try {
    const { flightNo, airline, departure, arrival, departureTime, arrivalTime, price, totalSeats, aircraft, status } = req.body;

    const { data: oldFlight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !oldFlight) return res.status(404).json({ message: '航班不存在' });

    const soldSeats = oldFlight.total_seats - oldFlight.available_seats;
    const newStatus = status || oldFlight.status;

    // If status changed to delayed, notify users
    if (newStatus === 'delayed' && oldFlight.status !== 'delayed') {
      await notifyUsersByFlight(oldFlight.id, 'delay', '航班延误通知',
        `您预订的航班 ${oldFlight.flight_no}（${oldFlight.departure}→${oldFlight.arrival}）已延误，请关注最新动态。`);
    }

    // If status changed to cancelled, auto-cancel related orders and release seats
    let autoCancelledCount = 0;
    if (newStatus === 'cancelled' && oldFlight.status !== 'cancelled') {
      const { data: affectedOrders } = await supabase
        .from('orders')
        .select('*')
        .eq('flight_id', oldFlight.id)
        .in('status', ['paid', 'refund_pending']);

      if (affectedOrders && affectedOrders.length > 0) {
        for (const order of affectedOrders) {
          await supabase
            .from('orders')
            .update({ status: 'cancelled' })
            .eq('id', order.id);

          await createNotification(order.user_id, 'flight_cancel', '航班取消通知',
            `您预订的航班 ${oldFlight.flight_no}（${oldFlight.departure}→${oldFlight.arrival}）已被取消，订单 ${order.id} 已自动取消并释放座位。`);
        }
        autoCancelledCount = affectedOrders.length;
      }
    }

    const { data: updatedFlight, error: updateError } = await supabase
      .from('flights')
      .update({
        flight_no: sanitize(flightNo.trim()),
        airline: sanitize(airline.trim()),
        departure: sanitize(departure.trim()),
        arrival: sanitize(arrival.trim()),
        departure_time: departureTime,
        arrival_time: arrivalTime,
        price,
        total_seats: totalSeats,
        aircraft: sanitize(aircraft.trim()),
        status: newStatus,
        available_seats: Math.max(0, totalSeats - soldSeats)
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    const msg = autoCancelledCount > 0
      ? `更新成功，已自动取消 ${autoCancelledCount} 个关联订单`
      : '更新成功';
    res.json({ message: msg, flight: toFlight(updatedFlight) });
  } catch (err) {
    console.error('Update flight error:', err);
    res.status(500).json({ message: '更新航班失败' });
  }
});

router.delete('/flights/:id', adminAuth, async (req, res) => {
  try {
    const { data: flight, error: fetchError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !flight) return res.status(404).json({ message: '航班不存在' });

    // Cancel all paid orders for this flight and notify users
    const { data: affectedOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('flight_id', req.params.id)
      .in('status', ['paid', 'refund_pending']);

    if (affectedOrders && affectedOrders.length > 0) {
      for (const order of affectedOrders) {
        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id);

        await createNotification(order.user_id, 'flight_cancel',
          '航班取消通知',
          `您预订的航班 ${flight.flight_no}（${flight.departure}→${flight.arrival}）已被取消，订单 ${order.id} 已自动取消并释放座位。`);
      }
    }

    const { error: deleteError } = await supabase
      .from('flights')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    res.json({
      message: `删除成功，已自动取消 ${affectedOrders ? affectedOrders.length : 0} 个相关订单`,
      cancelledOrders: affectedOrders ? affectedOrders.length : 0
    });
  } catch (err) {
    console.error('Delete flight error:', err);
    res.status(500).json({ message: '删除航班失败' });
  }
});

// Get affected order count for a flight (used by frontend confirm dialog)
router.get('/flights/:id/orders-count', adminAuth, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('flight_id', req.params.id)
      .in('status', ['paid', 'refund_pending']);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    console.error('Get orders count error:', err);
    res.status(500).json({ message: '获取订单数失败' });
  }
});

// === User management ===
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, real_name, email, phone, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = data.map(u => ({
      id: u.id,
      username: u.username,
      realName: u.real_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.created_at
    }));

    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: '获取用户列表失败' });
  }
});

router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { realName, email, phone, role } = req.body;
    const updates = {};
    if (realName !== undefined) updates.real_name = sanitize(realName);
    if (email !== undefined) updates.email = sanitize(email);
    if (phone !== undefined) updates.phone = sanitize(phone);
    if (role !== undefined && ['user', 'admin'].includes(role)) updates.role = role;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: '更新成功' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: '更新用户失败' });
  }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !user) return res.status(404).json({ message: '用户不存在' });
    if (user.role === 'admin') return res.status(400).json({ message: '不能删除管理员' });

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: '删除用户失败' });
  }
});

// === Order management ===
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username');

    if (usersError) throw usersError;

    const userMap = new Map(users.map(u => [u.id, u.username]));
    const enriched = orders.map(o => ({
      ...toOrder(o),
      username: userMap.get(o.user_id) || '未知'
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ message: '获取订单列表失败' });
  }
});

router.put('/orders/:id/status', adminAuth, validateOrderStatus, async (req, res) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: req.body.status })
      .eq('id', req.params.id);

    if (error) throw error;

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    res.json({ message: '状态更新成功', order: toOrder(order) });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ message: '更新订单状态失败' });
  }
});

// Approve refund
router.put('/orders/:id/refund-approve', adminAuth, async (req, res) => {
  try {
    const { approved, rejectReason } = req.body;

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError || !order) return res.status(404).json({ message: '订单不存在' });
    if (order.status !== 'refund_pending') return res.status(400).json({ message: '该订单不在退款审核状态' });

    if (approved) {
      await supabase
        .from('orders')
        .update({ status: 'refunded' })
        .eq('id', req.params.id);

      const { data: flight } = await supabase
        .from('flights')
        .select('available_seats')
        .eq('id', order.flight_id)
        .single();

      if (flight) {
        await supabase
          .from('flights')
          .update({ available_seats: flight.available_seats + order.passengers.length })
          .eq('id', order.flight_id);
      }

      await createNotification(order.user_id, 'refund_approved', '退款成功',
        `您的订单 ${order.id} 退款已通过，${order.total_price} 元将在3-5个工作日内退回。`);
    } else {
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', req.params.id);

      await createNotification(order.user_id, 'refund_rejected', '退款被拒绝',
        `您的订单 ${order.id} 退款申请被拒绝，原因：${rejectReason || '未说明'}。`);
    }

    res.json({ message: approved ? '退款已通过' : '退款已拒绝' });
  } catch (err) {
    console.error('Approve refund error:', err);
    res.status(500).json({ message: '退款审核失败' });
  }
});

// Helper functions for notifications
async function createNotification(userId, type, title, content) {
  const notification = {
    id: 'N-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    user_id: userId,
    type,
    title,
    content
  };

  const { error } = await supabase
    .from('notifications')
    .insert([notification]);

  if (error) console.error('Create notification error:', error);
}

async function notifyUsersByFlight(flightId, type, title, content) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('user_id')
    .eq('flight_id', flightId)
    .eq('status', 'paid');

  if (error || !orders) return;

  const notified = new Set();
  for (const order of orders) {
    if (!notified.has(order.user_id)) {
      await createNotification(order.user_id, type, title, content);
      notified.add(order.user_id);
    }
  }
}

module.exports = router;
