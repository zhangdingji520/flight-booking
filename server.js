const express = require('express');
const path = require('path');
const fs = require('fs');
const { PORT } = require('./config');
const db = require('./db');

const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

const app = express();

app.use(express.json());

// Block cross-origin API requests
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers.host;
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) return res.status(403).json({ message: '跨域请求被拒绝' });
    } catch {
      return res.status(403).json({ message: '跨域请求被拒绝' });
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Initialize data files
const dataFiles = {
  'users.json': [],
  'flights.json': require('./data/seed-flights'),
  'orders.json': [],
  'notifications.json': []
};

for (const [file, defaultData] of Object.entries(dataFiles)) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

// Ensure default admin user
const users = db.read('users.json');
if (!users.find(u => u.role === 'admin')) {
  const bcrypt = require('bcryptjs');
  users.push({
    id: 'admin-001', username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    realName: 'System Admin', email: 'admin@flightbooking.com',
    phone: '13800000000', role: 'admin',
    createdAt: new Date().toISOString()
  });
  db.write('users.json', users);
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Flight booking server running on http://localhost:${PORT}`);
});
