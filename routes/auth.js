const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const JWT_SECRET = 'flight-booking-secret-key-2026';
const usersFile = path.join(__dirname, '..', 'data', 'users.json');

function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
}
function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Register
router.post('/register', (req, res) => {
  const { username, password, realName, email, phone } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  const users = readUsers();
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ message: '用户名已存在' });
  }
  const newUser = {
    id: uuidv4(),
    username,
    password: bcrypt.hashSync(password, 10),
    realName: realName || username,
    email: email || '',
    phone: phone || '',
    role: 'user',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeUsers(users);
  const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({
    message: '注册成功',
    token,
    user: { id: newUser.id, username: newUser.username, realName: newUser.realName, email: newUser.email, phone: newUser.phone, role: newUser.role }
  });
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({
    message: '登录成功',
    token,
    user: { id: user.id, username: user.username, realName: user.realName, email: user.email, phone: user.phone, role: user.role }
  });
});

// Get current user
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: '未登录' });
  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    const users = readUsers();
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ message: '用户不存在' });
    res.json({ id: user.id, username: user.username, realName: user.realName, email: user.email, phone: user.phone, role: user.role });
  } catch {
    res.status(401).json({ message: 'token 无效或已过期' });
  }
});

module.exports = router;
