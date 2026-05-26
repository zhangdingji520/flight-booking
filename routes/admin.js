const express = require('express');
const fs = require('fs');
const path = require('path');
const { adminAuth } = require('../middleware/auth');
const { validateFlight, validateOrderStatus } = require('../middleware/validate');

const router = express.Router();
const dataDir = path.join(__dirname, '..', 'data');

function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}
function writeJSON(name, data) {
  fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data, null, 2));
}

// === Dashboard stats ===
router.get('/stats', adminAuth, (req, res) => {
  const users = readJSON('users.json');
  const flights = readJSON('flights.json');
  const orders = readJSON('orders.json');
  const activeOrders = orders.filter(o => o.status === 'paid');
  res.json({
    totalUsers: users.filter(u => u.role !== 'admin').length,
    totalFlights: flights.length,
    totalOrders: orders.length,
    totalRevenue: activeOrders.reduce((sum, o) => sum + o.totalPrice, 0),
    cancelledOrders: orders.filter(o => o.status === 'cancelled').length
  });
});

// === Flight management ===
router.get('/flights', adminAuth, (req, res) => {
  res.json(readJSON('flights.json'));
});

router.post('/flights', adminAuth, validateFlight, (req, res) => {
  const flights = readJSON('flights.json');
  const { flightNo, airline, departure, arrival, departureTime, arrivalTime, price, totalSeats, aircraft, status } = req.body;
  const flight = {
    id: 'F' + (1000 + flights.length + 1),
    flightNo: flightNo.trim(),
    airline: airline.trim(),
    departure: departure.trim(),
    arrival: arrival.trim(),
    departureTime,
    arrivalTime,
    price,
    totalSeats,
    aircraft: aircraft.trim(),
    availableSeats: totalSeats,
    status: status || 'on-time'
  };
  flights.push(flight);
  writeJSON('flights.json', flights);
  res.json({ message: '添加成功', flight });
});

router.put('/flights/:id', adminAuth, validateFlight, (req, res) => {
  const flights = readJSON('flights.json');
  const idx = flights.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '航班不存在' });
  const { flightNo, airline, departure, arrival, departureTime, arrivalTime, price, totalSeats, aircraft, status } = req.body;
  Object.assign(flights[idx], {
    flightNo: flightNo.trim(),
    airline: airline.trim(),
    departure: departure.trim(),
    arrival: arrival.trim(),
    departureTime,
    arrivalTime,
    price,
    totalSeats,
    aircraft: aircraft.trim(),
    status: status || flights[idx].status
  });
  writeJSON('flights.json', flights);
  res.json({ message: '更新成功', flight: flights[idx] });
});

router.delete('/flights/:id', adminAuth, (req, res) => {
  let flights = readJSON('flights.json');
  flights = flights.filter(f => f.id !== req.params.id);
  writeJSON('flights.json', flights);
  res.json({ message: '删除成功' });
});

// === User management ===
router.get('/users', adminAuth, (req, res) => {
  res.json(readJSON('users.json').map(u => ({
    id: u.id, username: u.username, realName: u.realName, email: u.email, phone: u.phone, role: u.role, createdAt: u.createdAt
  })));
});

router.put('/users/:id', adminAuth, (req, res) => {
  const users = readJSON('users.json');
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const { realName, email, phone, role } = req.body;
  if (realName !== undefined) user.realName = realName;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined && ['user', 'admin'].includes(role)) user.role = role;
  writeJSON('users.json', users);
  res.json({ message: '更新成功' });
});

router.delete('/users/:id', adminAuth, (req, res) => {
  let users = readJSON('users.json');
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  if (user.role === 'admin') return res.status(400).json({ message: '不能删除管理员' });
  users = users.filter(u => u.id !== req.params.id);
  writeJSON('users.json', users);
  res.json({ message: '删除成功' });
});

// === Order management ===
router.get('/orders', adminAuth, (req, res) => {
  const orders = readJSON('orders.json');
  const users = readJSON('users.json');
  const enriched = orders.map(o => {
    const user = users.find(u => u.id === o.userId);
    return { ...o, username: user ? user.username : '未知' };
  });
  res.json(enriched);
});

router.put('/orders/:id/status', adminAuth, validateOrderStatus, (req, res) => {
  const orders = readJSON('orders.json');
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: '订单不存在' });
  order.status = req.body.status;
  writeJSON('orders.json', orders);
  res.json({ message: '状态更新成功', order });
});

module.exports = router;
