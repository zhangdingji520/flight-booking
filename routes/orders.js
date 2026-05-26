const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const JWT_SECRET = 'flight-booking-secret-key-2026';
const ordersFile = path.join(__dirname, '..', 'data', 'orders.json');
const flightsFile = path.join(__dirname, '..', 'data', 'flights.json');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: '请先登录' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'token 无效' });
  }
}

// Create order
router.post('/', authMiddleware, (req, res) => {
  const { flightId, passengers } = req.body;
  if (!flightId || !passengers || !passengers.length) {
    return res.status(400).json({ message: '请选择航班和乘客信息' });
  }

  const flights = readJSON(flightsFile);
  const flight = flights.find(f => f.id === flightId);
  if (!flight) return res.status(404).json({ message: '航班不存在' });
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

  // Update available seats
  flight.availableSeats -= passengers.length;
  writeJSON(flightsFile, flights);

  orders.push(order);
  writeJSON(ordersFile, orders);
  res.json({ message: '订票成功', order });
});

// Get my orders
router.get('/my', authMiddleware, (req, res) => {
  const orders = readJSON(ordersFile);
  const myOrders = orders.filter(o => o.userId === req.user.id);
  res.json(myOrders);
});

// Cancel order
router.put('/:id/cancel', authMiddleware, (req, res) => {
  const orders = readJSON(ordersFile);
  const flights = readJSON(flightsFile);
  const order = orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  if (order.status === 'cancelled') return res.status(400).json({ message: '订单已取消' });

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
