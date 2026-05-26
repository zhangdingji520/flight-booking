const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('../config');
const { authMiddleware } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  const { username, password, realName, email, phone } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
  if (password.length < 6) return res.status(400).json({ message: '密码至少6位' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ message: '用户名长度需在2-20之间' });
  const users = db.read('users.json');
  if (users.find(u => u.username === username)) return res.status(400).json({ message: '用户名已存在' });
  const newUser = {
    id: uuidv4(), username,
    password: bcrypt.hashSync(password, 10),
    realName: realName || username,
    email: email || '', phone: phone || '',
    role: 'user', createdAt: new Date().toISOString()
  };
  users.push(newUser);
  db.write('users.json', users);
  const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({
    message: '注册成功', token,
    user: { id: newUser.id, username: newUser.username, realName: newUser.realName, email: newUser.email, phone: newUser.phone, role: newUser.role }
  });
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
  const users = db.read('users.json');
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: '用户名或密码错误' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({
    message: '登录成功', token,
    user: { id: user.id, username: user.username, realName: user.realName, email: user.email, phone: user.phone, role: user.role }
  });
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const users = db.read('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  res.json({ id: user.id, username: user.username, realName: user.realName, email: user.email, phone: user.phone, role: user.role, createdAt: user.createdAt });
});

// Update profile
router.put('/profile', authMiddleware, (req, res) => {
  const { realName, email, phone } = req.body;
  const users = db.read('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  if (realName !== undefined) user.realName = realName;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  db.write('users.json', users);
  res.json({ message: '更新成功', user: { id: user.id, username: user.username, realName: user.realName, email: user.email, phone: user.phone, role: user.role } });
});

// Change password
router.put('/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ message: '请输入旧密码和新密码' });
  if (newPassword.length < 6) return res.status(400).json({ message: '新密码至少6位' });
  const users = db.read('users.json');
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(400).json({ message: '旧密码不正确' });
  user.password = bcrypt.hashSync(newPassword, 10);
  db.write('users.json', users);
  res.json({ message: '密码修改成功' });
});

// Profile stats
router.get('/profile/stats', authMiddleware, (req, res) => {
  const orders = db.read('orders.json').filter(o => o.userId === req.user.id);
  res.json({
    totalOrders: orders.length,
    paidOrders: orders.filter(o => o.status === 'paid').length,
    completedOrders: orders.filter(o => o.status === 'completed').length,
    totalSpent: orders.filter(o => o.status === 'paid' || o.status === 'completed').reduce((sum, o) => sum + o.totalPrice, 0)
  });
});

module.exports = router;
