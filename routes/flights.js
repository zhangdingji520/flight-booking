const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const flightsFile = path.join(__dirname, '..', 'data', 'flights.json');

function readFlights() {
  return JSON.parse(fs.readFileSync(flightsFile, 'utf8'));
}

// Search flights
router.get('/search', (req, res) => {
  const { departure, arrival, date } = req.query;
  let flights = readFlights();
  if (departure) {
    flights = flights.filter(f => f.departure.includes(departure));
  }
  if (arrival) {
    flights = flights.filter(f => f.arrival.includes(arrival));
  }
  if (date) {
    flights = flights.filter(f => f.departureTime.startsWith(date));
  }
  flights = flights.filter(f => f.status !== 'cancelled');
  res.json(flights);
});

// Get all flights
router.get('/', (req, res) => {
  const flights = readFlights();
  res.json(flights);
});

// Get single flight
router.get('/:id', (req, res) => {
  const flights = readFlights();
  const flight = flights.find(f => f.id === req.params.id);
  if (!flight) return res.status(404).json({ message: '航班不存在' });
  res.json(flight);
});

module.exports = router;
