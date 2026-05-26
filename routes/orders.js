const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const ordersFile = path.join(__dirname, '..', 'data', 'orders.json');
const flightsFile = path.join(__dirname, '..', 'data', 'flights.json');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Create order
router.post('/', authMiddleware, (req, res) => {
  const { flightId, passengers } = req.body;
  if (!flightId || !passengers || !Array.isArray(passengers) || !passengers.length) {
    return res.status(400).json({ message: '请选择航班和乘客信息' });
  }
  if (passengers.length > 5) {
    return res.status(400).json({ message: '每次最多预订5位乘客' });
  }
  for (const p of passengers) {
    if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
      return res.status(400).json({ message: '乘客姓名不能为空' });
    }
  }

  const flights = readJSON(flightsFile);
  const flight = flights.find(f => f.id === flightId);
  if (!flight) return res.status(404).json({ message: '航班不存在' });
  if (flight.status === 'cancelled') return res.status(400).json({ message: '该航班已取消' });
  if (flight.availableSeats < passengers.length) {
    return res.status(400).json({ message: '余票不足' });
  }

  const orders = readJSON(ordersFile);
  const order = {
    id: 'ORD-' + uuidv4().slice(0, 8).toUpperCase(),
    userId: req.user.id,
    flightId,
    flightNo: flight.flightNo,
    airline: flight.airline,
    departure: flight.departure,
    arrival: flight.arrival,
    departureTime: flight.departureTime,
    arrivalTime: flight.arrivalTime,
    passengers,
    totalPrice: flight.price * passengers.length,
    unitPrice: flight.price,
    status: 'paid',
    createdAt: new Date().toISOString()
  };

  flight.availableSeats -= passengers.length;
  writeJSON(flightsFile, flights);

  orders.push(order);
  writeJSON(ordersFile, orders);
  res.json({ message: '订票成功', order });
});

// Get my orders
router.get('/my', authMiddleware, (req, res) => {
  const orders = readJSON(ordersFile);
  res.json(orders.filter(o => o.userId === req.user.id));
});

// Cancel order
router.put('/:id/cancel', authMiddleware, (req, res) => {
  const orders = readJSON(ordersFile);
  const flights = readJSON(flightsFile);
  const order = orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  if (order.status === 'cancelled') return res.status(400).json({ message: '订单已取消' });
  if (order.status === 'refunded') return res.status(400).json({ message: '已退款订单无法操作' });

  order.status = 'cancelled';
  const flight = flights.find(f => f.id === order.flightId);
  if (flight) {
    flight.availableSeats += order.passengers.length;
  }
  writeJSON(ordersFile, orders);
  writeJSON(flightsFile, flights);
  res.json({ message: '取消成功', order });
});

module.exports = router;
