const express = require('express');
const supabase = require('../db-supabase');

const router = express.Router();

// Helper to convert flight row to camelCase
function toFlight(row) {
  if (!row) return null;
  return {
    id: row.id,
    flightNo: row.flight_no,
    airline: row.airline,
    departure: row.departure,
    arrival: row.arrival,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    price: parseFloat(row.price),
    totalSeats: row.total_seats,
    availableSeats: row.available_seats,
    aircraft: row.aircraft,
    status: row.status,
    createdAt: row.created_at
  };
}

// Search flights
router.get('/search', async (req, res) => {
  try {
    const { departure, arrival, date, sort } = req.query;

    let query = supabase
      .from('flights')
      .select('*')
      .neq('status', 'cancelled');

    if (departure) {
      query = query.ilike('departure', `%${departure}%`);
    }
    if (arrival) {
      query = query.ilike('arrival', `%${arrival}%`);
    }
    if (date) {
      query = query.gte('departure_time', date).lt('departure_time', date + ' 23:59:59');
    }

    if (sort === 'price') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'time') {
      query = query.order('departure_time', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    const flights = data.map(toFlight);
    res.json(flights);
  } catch (err) {
    console.error('Search flights error:', err);
    res.status(500).json({ message: '搜索航班失败' });
  }
});

// Get all flights
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const flights = data.map(toFlight);
    res.json(flights);
  } catch (err) {
    console.error('Get all flights error:', err);
    res.status(500).json({ message: '获取航班列表失败' });
  }
});

// Get single flight
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('flights')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: '航班不存在' });

    res.json(toFlight(data));
  } catch (err) {
    console.error('Get flight error:', err);
    res.status(500).json({ message: '获取航班信息失败' });
  }
});

module.exports = router;
