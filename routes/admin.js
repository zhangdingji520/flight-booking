const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { adminAuth } = require('../middleware/auth');
const { validateFlight, validateOrderStatus } = require('../middleware/validate');
const { createNotification, notifyUsersByFlight } = require('../services/notify');
const db = require('../db');

const router = express.Router();

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// === Dashboard stats ===
router.get('/stats', adminAuth, (req, res) => {
  const users = db.read('users.json');
  const flights = db.read('flights.json');
  const orders = db.read('orders.json');
  const activeOrders = orders.filter(o => o.status === 'paid');
  res.json({
    totalUsers: users.filter(u => u.role !== 'admin').length,
    totalFlights: flights.length,
    totalOrders: orders.length,
    totalRevenue: activeOrders.reduce((sum, o) => sum + o.totalPrice, 0),
    cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
    pendingRefunds: orders.filter(o => o.status === 'refund_pending').length
  });
});

// === Flight management ===
router.get('/flights', adminAuth, (req, res) => {
  res.json(db.read('flights.json'));
});

router.post('/flights', adminAuth, validateFlight, (req, res) => {
  const flights = db.read('flights.json');
  const { flightNo, airline, departure, arrival, departureTime, arrivalTime, price, totalSeats, aircraft, status } = req.body;
  const flight = {
    id: 'F' + uuidv4().slice(0, 6).toUpperCase(),
    flightNo: sanitize(flightNo.trim()), airline: sanitize(airline.trim()),
    departure: sanitize(departure.trim()), arrival: sanitize(arrival.trim()),
    departureTime, arrivalTime, price, totalSeats,
    aircraft: sanitize(aircraft.trim()), availableSeats: totalSeats,
    status: status || 'on-time'
  };
  flights.push(flight);
  db.write('flights.json', flights);
  res.json({ message: '添加成功', flight });
});

router.put('/flights/:id', adminAuth, validateFlight, (req, res) => {
  const flights = db.read('flights.json');
  const idx = flights.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '航班不存在' });
  const { flightNo, airline, departure, arrival, departureTime, arrivalTime, price, totalSeats, aircraft, status } = req.body;
  const old = flights[idx];
  const soldSeats = old.totalSeats - old.availableSeats;
  const newStatus = status || old.status;

  // If status changed to delayed, notify users
  if (newStatus === 'delayed' && old.status !== 'delayed') {
    notifyUsersByFlight(old.id, 'delay', '航班延误通知', `您预订的航班 ${old.flightNo}（${old.departure}→${old.arrival}）已延误，请关注最新动态。`);
  }

  // If status changed to cancelled, auto-cancel related orders and release seats
  let autoCancelledCount = 0;
  if (newStatus === 'cancelled' && old.status !== 'cancelled') {
    const orders = db.read('orders.json');
    const affected = orders.filter(o => o.flightId === old.id && (o.status === 'paid' || o.status === 'refund_pending'));
    for (const order of affected) {
      order.status = 'cancelled';
      createNotification(order.userId, 'flight_cancel', '航班取消通知',
        `您预订的航班 ${old.flightNo}（${old.departure}→${old.arrival}）已被取消，订单 ${order.id} 已自动取消并释放座位。`);
    }
    if (affected.length > 0) {
      db.write('orders.json', orders);
      autoCancelledCount = affected.length;
    }
  }

  Object.assign(flights[idx], {
    flightNo: sanitize(flightNo.trim()), airline: sanitize(airline.trim()),
    departure: sanitize(departure.trim()), arrival: sanitize(arrival.trim()),
    departureTime, arrivalTime, price, totalSeats,
    aircraft: sanitize(aircraft.trim()), status: newStatus,
    availableSeats: Math.max(0, totalSeats - soldSeats)
  });
  db.write('flights.json', flights);
  const msg = autoCancelledCount > 0
    ? `更新成功，已自动取消 ${autoCancelledCount} 个关联订单`
    : '更新成功';
  res.json({ message: msg, flight: flights[idx] });
});

router.delete('/flights/:id', adminAuth, (req, res) => {
  const flights = db.read('flights.json');
  const flight = flights.find(f => f.id === req.params.id);
  if (!flight) return res.status(404).json({ message: '航班不存在' });

  // Cancel all paid orders for this flight and notify users
  const orders = db.read('orders.json');
  const affected = orders.filter(o => o.flightId === req.params.id && (o.status === 'paid' || o.status === 'refund_pending'));
  for (const order of affected) {
    order.status = 'cancelled';
    createNotification(order.userId, 'flight_cancel',
      '航班取消通知',
      `您预订的航班 ${flight.flightNo}（${flight.departure}→${flight.arrival}）已被取消，订单 ${order.id} 已自动取消并释放座位。`);
  }
  if (affected.length > 0) db.write('orders.json', orders);

  const remaining = flights.filter(f => f.id !== req.params.id);
  db.write('flights.json', remaining);
  res.json({ message: `删除成功，已自动取消 ${affected.length} 个相关订单`, cancelledOrders: affected.length });
});

// Get affected order count for a flight (used by frontend confirm dialog)
router.get('/flights/:id/orders-count', adminAuth, (req, res) => {
  const orders = db.read('orders.json');
  const count = orders.filter(o => o.flightId === req.params.id && (o.status === 'paid' || o.status === 'refund_pending')).length;
  res.json({ count });
});

// === User management ===
router.get('/users', adminAuth, (req, res) => {
  res.json(db.read('users.json').map(u => ({
    id: u.id, username: u.username, realName: u.realName, email: u.email, phone: u.phone, role: u.role, createdAt: u.createdAt
  })));
});

router.put('/users/:id', adminAuth, (req, res) => {
  const users = db.read('users.json');
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const { realName, email, phone, role } = req.body;
  if (realName !== undefined) user.realName = sanitize(realName);
  if (email !== undefined) user.email = sanitize(email);
  if (phone !== undefined) user.phone = sanitize(phone);
  if (role !== undefined && ['user', 'admin'].includes(role)) user.role = role;
  db.write('users.json', users);
  res.json({ message: '更新成功' });
});

router.delete('/users/:id', adminAuth, (req, res) => {
  let users = db.read('users.json');
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  if (user.role === 'admin') return res.status(400).json({ message: '不能删除管理员' });
  users = users.filter(u => u.id !== req.params.id);
  db.write('users.json', users);
  res.json({ message: '删除成功' });
});

// === Order management ===
router.get('/orders', adminAuth, (req, res) => {
  const orders = db.read('orders.json');
  const users = db.read('users.json');
  const enriched = orders.map(o => {
    const user = users.find(u => u.id === o.userId);
    return { ...o, username: user ? user.username : '未知' };
  });
  res.json(enriched);
});

router.put('/orders/:id/status', adminAuth, validateOrderStatus, (req, res) => {
  const orders = db.read('orders.json');
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  order.status = req.body.status;
  db.write('orders.json', orders);
  res.json({ message: '状态更新成功', order });
});

// Approve refund
router.put('/orders/:id/refund-approve', adminAuth, (req, res) => {
  const { approved, rejectReason } = req.body;
  const orders = db.read('orders.json');
  const flights = db.read('flights.json');
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  if (order.status !== 'refund_pending') return res.status(400).json({ message: '该订单不在退款审核状态' });

  if (approved) {
    order.status = 'refunded';
    const flight = flights.find(f => f.id === order.flightId);
    if (flight) flight.availableSeats += order.passengers.length;
    db.write('flights.json', flights);
    createNotification(order.userId, 'refund_approved', '退款成功', `您的订单 ${order.id} 退款已通过，${order.totalPrice} 元将在3-5个工作日内退回。`);
  } else {
    order.status = 'paid';
    createNotification(order.userId, 'refund_rejected', '退款被拒绝', `您的订单 ${order.id} 退款申请被拒绝，原因：${rejectReason || '未说明'}。`);
  }
  db.write('orders.json', orders);
  res.json({ message: approved ? '退款已通过' : '退款已拒绝' });
});

module.exports = router;
