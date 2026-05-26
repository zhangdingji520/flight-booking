const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const seedFlights = require('../data/seed-flights');

const dataDir = path.join(__dirname, '..', 'data');

function resetData() {
  fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(dataDir, 'notifications.json'), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(dataDir, 'flights.json'), JSON.stringify(seedFlights, null, 2));
}

function seedAdmin() {
  const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
  const admin = {
    id: 'admin-001', username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    realName: 'System Admin', email: 'admin@test.com',
    phone: '13800000000', role: 'admin',
    createdAt: new Date().toISOString()
  };
  users.push(admin);
  fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users, null, 2));
  return admin;
}

function seedUser(overrides = {}) {
  const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
  const rawPassword = overrides.password || 'test123456';
  const user = {
    id: overrides.id || 'user-001',
    username: overrides.username || 'testuser',
    password: bcrypt.hashSync(rawPassword, 10),
    realName: overrides.realName || 'Test User',
    email: overrides.email || 'test@test.com',
    phone: overrides.phone || '13900000000',
    role: 'user',
    createdAt: new Date().toISOString()
  };
  if (!users.find(u => u.id === user.id)) {
    users.push(user);
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users, null, 2));
  }
  return user;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authHeader(user) {
  return { Authorization: `Bearer ${generateToken(user)}` };
}

module.exports = { resetData, seedAdmin, seedUser, generateToken, authHeader };
