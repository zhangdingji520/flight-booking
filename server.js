const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PORT } = require('./config');
const supabase = require('./db-supabase');

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

// Initialize admin user and seed flights
async function initializeData() {
  try {
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .maybeSingle();

    if (adminError) {
      console.error('Check admin error:', adminError);
    }

    if (!adminUser) {
      const { error: createAdminError } = await supabase
        .from('users')
        .insert([{
          id: 'admin-001',
          username: 'admin',
          password: bcrypt.hashSync('admin123', 10),
          real_name: 'System Admin',
          email: 'admin@flightbooking.com',
          phone: '13800000000',
          role: 'admin'
        }]);

      if (createAdminError) {
        console.error('Create admin error:', createAdminError);
      } else {
        console.log('Default admin user created');
      }
    }

    const { count: flightCount, error: countError } = await supabase
      .from('flights')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      console.error('Check flights error:', countError);
    }

    if (!flightCount || flightCount === 0) {
      const seedFlights = require('./data/seed-flights');
      const flights = seedFlights.map(f => ({
        id: f.id,
        flight_no: f.flightNo,
        airline: f.airline,
        departure: f.departure,
        arrival: f.arrival,
        departure_time: f.departureTime,
        arrival_time: f.arrivalTime,
        price: f.price,
        total_seats: f.totalSeats,
        available_seats: f.availableSeats,
        aircraft: f.aircraft,
        status: f.status
      }));

      const { error: insertError } = await supabase
        .from('flights')
        .insert(flights);

      if (insertError) {
        console.error('Seed flights error:', insertError);
      } else {
        console.log(`Seeded ${flights.length} flights`);
      }
    }
  } catch (err) {
    console.error('Initialize data error:', err);
  }
}

initializeData();

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

// Only start listening when run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Flight booking server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
