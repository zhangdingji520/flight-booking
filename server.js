const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Initialize data files
const dataFiles = {
  'users.json': [],
  'flights.json': require('./data/seed-flights'),
  'orders.json': []
};

for (const [file, defaultData] of Object.entries(dataFiles)) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    const content = file === 'flights.json' ? defaultData : defaultData;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  }
}

// Ensure default admin user
const usersPath = path.join(dataDir, 'users.json');
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
if (!users.find(u => u.role === 'admin')) {
  const bcrypt = require('bcryptjs');
  users.push({
    id: 'admin-001',
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    realName: 'System Admin',
    email: 'admin@flightbooking.com',
    phone: '13800000000',
    role: 'admin',
    createdAt: new Date().toISOString()
  });
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Flight booking server running on http://localhost:${PORT}`);
});
