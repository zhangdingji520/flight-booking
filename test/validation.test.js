const request = require('supertest');
const app = require('../server');
const { resetData, seedAdmin, seedUser, authHeader } = require('./setup');

beforeEach(() => {
  resetData();
});

describe('Flight Validation', () => {
  let admin;

  beforeEach(() => {
    admin = seedAdmin();
  });

  const validFlight = {
    flightNo: 'XX1234', airline: 'Test Air',
    departure: '北京', arrival: '上海',
    departureTime: '2026-07-01 08:00', arrivalTime: '2026-07-01 10:30',
    price: 500, totalSeats: 100, aircraft: 'A320'
  };

  it('should accept valid flight data', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send(validFlight);
    expect(res.status).toBe(200);
  });

  it('should reject missing flightNo', async () => {
    const { flightNo: _flightNo, ...body } = validFlight;
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/航班号/);
  });

  it('should reject missing airline', async () => {
    const { airline: _airline, ...body } = validFlight;
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send(body);
    expect(res.status).toBe(400);
  });

  it('should reject missing departure', async () => {
    const { departure: _departure, ...body } = validFlight;
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send(body);
    expect(res.status).toBe(400);
  });

  it('should reject missing arrival', async () => {
    const { arrival: _arrival, ...body } = validFlight;
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send(body);
    expect(res.status).toBe(400);
  });

  it('should reject missing times', async () => {
    const { departureTime: _dt, arrivalTime: _at, ...body } = validFlight;
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send(body);
    expect(res.status).toBe(400);
  });

  it('should reject arrival before departure', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight,
      departureTime: '2026-07-01 10:00',
      arrivalTime: '2026-07-01 08:00'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/到达时间/);
  });

  it('should reject zero price', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight, price: 0
    });
    expect(res.status).toBe(400);
  });

  it('should reject negative price', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight, price: -100
    });
    expect(res.status).toBe(400);
  });

  it('should reject non-integer totalSeats', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight, totalSeats: 100.5
    });
    expect(res.status).toBe(400);
  });

  it('should reject zero totalSeats', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight, totalSeats: 0
    });
    expect(res.status).toBe(400);
  });

  it('should reject missing aircraft', async () => {
    const { aircraft: _aircraft, ...body } = validFlight;
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send(body);
    expect(res.status).toBe(400);
  });

  it('should reject invalid flight status', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight, status: 'unknown'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/状态无效/);
  });

  it('should accept valid flight status on-time', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight, status: 'on-time'
    });
    expect(res.status).toBe(200);
  });

  it('should sanitize XSS in string fields', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin)).send({
      ...validFlight,
      flightNo: '<script>alert(1)</script>',
      airline: '<img onerror=alert(1)>'
    });
    expect(res.status).toBe(200);
    expect(res.body.flight.flightNo).not.toContain('<script>');
    expect(res.body.flight.airline).not.toContain('<img');
  });

  it('should validate flight on update too', async () => {
    const res = await request(app).put('/api/admin/flights/F1001').set(authHeader(admin)).send({
      price: -1
    });
    expect(res.status).toBe(400);
  });
});

describe('Flight Search', () => {
  it('should return all non-cancelled flights by default', async () => {
    const res = await request(app).get('/api/flights/search');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every(f => f.status !== 'cancelled')).toBe(true);
  });

  it('should filter by departure city', async () => {
    const res = await request(app).get('/api/flights/search?departure=' + encodeURIComponent('北京'));
    expect(res.status).toBe(200);
    expect(res.body.every(f => f.departure.includes('北京'))).toBe(true);
  });

  it('should filter by arrival city', async () => {
    const res = await request(app).get('/api/flights/search?arrival=' + encodeURIComponent('上海'));
    expect(res.status).toBe(200);
    expect(res.body.every(f => f.arrival.includes('上海'))).toBe(true);
  });

  it('should sort by price', async () => {
    const res = await request(app).get('/api/flights/search?sort=price');
    expect(res.status).toBe(200);
    const prices = res.body.map(f => f.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('should sort by time', async () => {
    const res = await request(app).get('/api/flights/search?sort=time');
    expect(res.status).toBe(200);
    for (let i = 1; i < res.body.length; i++) {
      expect(new Date(res.body[i].departureTime).getTime()).toBeGreaterThanOrEqual(
        new Date(res.body[i - 1].departureTime).getTime()
      );
    }
  });
});

describe('Order Status Validation', () => {
  let admin;

  beforeEach(() => {
    admin = seedAdmin();
  });

  it('should reject invalid order status', async () => {
    const user = seedUser();
    const orderRes = await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

    const res = await request(app)
      .put(`/api/admin/orders/${orderRes.body.order.id}/status`)
      .set(authHeader(admin))
      .send({ status: 'not_a_status' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/状态无效/);
  });

  it('should accept all valid order statuses', async () => {
    const user = seedUser();
    const validStatuses = ['paid', 'completed', 'cancelled', 'refunded', 'refund_pending'];

    for (const status of validStatuses) {
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

      const res = await request(app)
        .put(`/api/admin/orders/${orderRes.body.order.id}/status`)
        .set(authHeader(admin))
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(status);
    }
  });
});
