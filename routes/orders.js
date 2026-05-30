const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../db-supabase');

const router = express.Router();

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

// Create order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { flightId, passengers } = req.body;
    if (!flightId || !passengers || !Array.isArray(passengers) || !passengers.length) {
      return res.status(400).json({ message: '请选择航班和乘客信息' });
    }
    if (passengers.length > 5) return res.status(400).json({ message: '每次最多预订5位乘客' });
    for (const p of passengers) {
      if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
        return res.status(400).json({ message: '乘客姓名不能为空' });
      }
    }

    const { data: flight, error: flightError } = await supabase
      .from('flights')
      .select('*')
      .eq('id', flightId)
      .single();

    if (flightError || !flight) return res.status(404).json({ message: '航班不存在' });
    if (flight.status === 'cancelled') return res.status(400).json({ message: '该航班已取消' });
    if (flight.available_seats < passengers.length) return res.status(400).json({ message: '余票不足' });

    const order = {
      id: 'ORD-' + uuidv4().slice(0, 8).toUpperCase(),
      user_id: req.user.id,
      flight_id: flightId,
      flight_no: flight.flight_no,
      airline: flight.airline,
      departure: flight.departure,
      arrival: flight.arrival,
      departure_time: flight.departure_time,
      arrival_time: flight.arrival_time,
      passengers: passengers,
      total_price: parseFloat(flight.price) * passengers.length,
      unit_price: parseFloat(flight.price),
      status: 'paid'
    };

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([order])
      .select()
      .single();

    if (orderError) throw orderError;

    const { error: updateError } = await supabase
      .from('flights')
      .update({ available_seats: flight.available_seats - passengers.length })
      .eq('id', flightId);

    if (updateError) throw updateError;

    res.json({ message: '订票成功', order: toOrder(newOrder) });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: '订票失败' });
  }
});

// Get my orders
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(orders.map(toOrder));
  } catch (err) {
    console.error('Get my orders error:', err);
    res.status(500).json({ message: '获取订单失败' });
  }
});

// Cancel order
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ message: '订单不存在' });
    if (order.status === 'cancelled') return res.status(400).json({ message: '订单已取消' });
    if (order.status === 'refunded') return res.status(400).json({ message: '已退款订单无法操作' });
    if (order.status === 'refund_pending') return res.status(400).json({ message: '退款审核中，请等待' });

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id);

    if (updateOrderError) throw updateOrderError;

    const { data: flight, error: flightError } = await supabase
      .from('flights')
      .select('available_seats')
      .eq('id', order.flight_id)
      .single();

    if (!flightError && flight) {
      await supabase
        .from('flights')
        .update({ available_seats: flight.available_seats + order.passengers.length })
        .eq('id', order.flight_id);
    }

    const { data: updatedOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    res.json({ message: '取消成功', order: toOrder(updatedOrder) });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ message: '取消订单失败' });
  }
});

// Request refund
router.put('/:id/refund-request', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ message: '请填写退款原因' });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ message: '订单不存在' });
    if (order.status === 'refund_pending') return res.status(400).json({ message: '您已提交过退款申请，请耐心等待审核' });
    if (order.status !== 'paid') return res.status(400).json({ message: '只有已支付的订单可以申请退款' });

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'refund_pending',
        refund_reason: reason.trim(),
        refund_requested_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    const { data: updatedOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    res.json({ message: '退款申请已提交，请等待管理员审核', order: toOrder(updatedOrder) });
  } catch (err) {
    console.error('Request refund error:', err);
    res.status(500).json({ message: '退款申请失败' });
  }
});

module.exports = router;
