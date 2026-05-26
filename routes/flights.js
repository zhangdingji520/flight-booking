const express = require('express');
const db = require('../db');

const router = express.Router();

// Search flights
router.get('/search', (req, res) => {
  const { departure, arrival, date, sort } = req.query;
  let flights = db.read('flights.json');
  if (departure) flights = flights.filter(f => f.departure.includes(departure));
  if (arrival) flights = flights.filter(f => f.arrival.includes(arrival));
  if (date) flights = flights.filter(f => f.departureTime.startsWith(date));
  flights = flights.filter(f => f.status !== 'cancelled');

  if (sort === 'price') flights.sort((a, b) => a.price - b.price);
  else if (sort === 'time') flights.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

  res.json(flights);
});

// Get all flights
router.get('/', (req, res) => {
  res.json(db.read('flights.json'));
});

// Get single flight
router.get('/:id', (req, res) => {
  const flight = db.read('flights.json').find(f => f.id === req.params.id);
  if (!flight) return res.status(404).json({ message: '航班不存在' });
  res.json(flight);
});

module.exports = router;
