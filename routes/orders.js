const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Create order
router.post('/', authMiddleware, (req, res) => {
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
  const flights = db.read('flights.json');
  const flight = flights.find(f => f.id === flightId);
  if (!flight) return res.status(404).json({ message: '航班不存在' });
  if (flight.status === 'cancelled') return res.status(400).json({ message: '该航班已取消' });
  if (flight.availableSeats < passengers.length) return res.status(400).json({ message: '余票不足' });

  const orders = db.read('orders.json');
  const order = {
    id: 'ORD-' + uuidv4().slice(0, 8).toUpperCase(),
    userId: req.user.id, flightId,
    flightNo: flight.flightNo, airline: flight.airline,
    departure: flight.departure, arrival: flight.arrival,
    departureTime: flight.departureTime, arrivalTime: flight.arrivalTime,
    passengers, totalPrice: flight.price * passengers.length,
    unitPrice: flight.price, status: 'paid',
    createdAt: new Date().toISOString()
  };
  flight.availableSeats -= passengers.length;
  db.write('flights.json', flights);
  orders.push(order);
  db.write('orders.json', orders);
  res.json({ message: '订票成功', order });
});

// Get my orders
router.get('/my', authMiddleware, (req, res) => {
  res.json(db.read('orders.json').filter(o => o.userId === req.user.id));
});

// Cancel order
router.put('/:id/cancel', authMiddleware, (req, res) => {
  const orders = db.read('orders.json');
  const flights = db.read('flights.json');
  const order = orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  if (order.status === 'cancelled') return res.status(400).json({ message: '订单已取消' });
  if (order.status === 'refunded') return res.status(400).json({ message: '已退款订单无法操作' });
  if (order.status === 'refund_pending') return res.status(400).json({ message: '退款审核中，请等待' });
  order.status = 'cancelled';
  const flight = flights.find(f => f.id === order.flightId);
  if (flight) flight.availableSeats += order.passengers.length;
  db.write('orders.json', orders);
  db.write('flights.json', flights);
  res.json({ message: '取消成功', order });
});

// Request refund
router.put('/:id/refund-request', authMiddleware, (req, res) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) return res.status(400).json({ message: '请填写退款原因' });
  const orders = db.read('orders.json');
  const order = orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  if (order.status === 'refund_pending') return res.status(400).json({ message: '您已提交过退款申请，请耐心等待审核' });
  if (order.status !== 'paid') return res.status(400).json({ message: '只有已支付的订单可以申请退款' });
  order.status = 'refund_pending';
  order.refundReason = reason.trim();
  order.refundRequestedAt = new Date().toISOString();
  db.write('orders.json', orders);
  res.json({ message: '退款申请已提交，请等待管理员审核', order });
});

module.exports = router;
