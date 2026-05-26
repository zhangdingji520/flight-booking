const request = require('supertest');
const app = require('../server');
const { resetData, seedAdmin, seedUser, authHeader } = require('./setup');

beforeEach(() => {
  resetData();
});

describe('Admin Routes - Permission Control', () => {
  it('should reject unauthenticated access to admin stats', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('should reject regular user access to admin stats', async () => {
    const user = seedUser();
    const res = await request(app).get('/api/admin/stats').set(authHeader(user));
    expect(res.status).toBe(403);
  });

  it('should allow admin access to stats', async () => {
    const admin = seedAdmin();
    const res = await request(app).get('/api/admin/stats').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalUsers');
    expect(res.body).toHaveProperty('totalFlights');
  });

  it('should reject regular user from creating flights', async () => {
    const user = seedUser();
    const res = await request(app).post('/api/admin/flights').set(authHeader(user))
      .send({
        flightNo: 'XX1234', airline: 'Test Air',
        departure: '北京', arrival: '上海',
        departureTime: '2026-07-01 08:00', arrivalTime: '2026-07-01 10:00',
        price: 500, totalSeats: 100, aircraft: 'A320'
      });
    expect(res.status).toBe(403);
  });

  it('should reject regular user from deleting flights', async () => {
    const user = seedUser();
    const res = await request(app).delete('/api/admin/flights/F1001').set(authHeader(user));
    expect(res.status).toBe(403);
  });

  it('should reject regular user from managing orders', async () => {
    const user = seedUser();
    const res = await request(app).get('/api/admin/orders').set(authHeader(user));
    expect(res.status).toBe(403);
  });

  it('should reject regular user from managing users', async () => {
    const user = seedUser();
    const res = await request(app).get('/api/admin/users').set(authHeader(user));
    expect(res.status).toBe(403);
  });
});

describe('Admin Flight Management', () => {
  let admin;

  beforeEach(() => {
    admin = seedAdmin();
  });

  it('should create a new flight', async () => {
    const res = await request(app).post('/api/admin/flights').set(authHeader(admin))
      .send({
        flightNo: 'XX1234', airline: 'Test Air',
        departure: '北京', arrival: '上海',
        departureTime: '2026-07-01 08:00', arrivalTime: '2026-07-01 10:30',
        price: 500, totalSeats: 100, aircraft: 'A320'
      });
    expect(res.status).toBe(200);
    expect(res.body.flight.flightNo).toBe('XX1234');
    expect(res.body.flight.availableSeats).toBe(100);
  });

  it('should update an existing flight', async () => {
    const res = await request(app).put('/api/admin/flights/F1001').set(authHeader(admin))
      .send({
        flightNo: 'CA1234', airline: '国航',
        departure: '北京', arrival: '上海',
        departureTime: '2026-06-01 08:00', arrivalTime: '2026-06-01 10:30',
        price: 1200, totalSeats: 180, aircraft: 'Boeing 737'
      });
    expect(res.status).toBe(200);
    expect(res.body.flight.price).toBe(1200);
  });

  it('should delete a flight', async () => {
    const res = await request(app).delete('/api/admin/flights/F1001').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/删除成功/);

    const all = await request(app).get('/api/flights');
    expect(all.body.find(f => f.id === 'F1001')).toBeUndefined();
  });

  it('should auto-cancel orders when flight status changes to cancelled', async () => {
    const user = seedUser();
    const orderRes = await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: '张三' }] });
    const orderId = orderRes.body.order.id;

    const res = await request(app).put('/api/admin/flights/F1001').set(authHeader(admin))
      .send({
        flightNo: 'CA1234', airline: '国航',
        departure: '北京', arrival: '上海',
        departureTime: '2026-06-01 08:00', arrivalTime: '2026-06-01 10:30',
        price: 980, totalSeats: 180, aircraft: 'Boeing 737',
        status: 'cancelled'
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/自动取消/);

    const myOrders = await request(app).get('/api/orders/my').set(authHeader(user));
    const order = myOrders.body.find(o => o.id === orderId);
    expect(order.status).toBe('cancelled');
  });

  it('should auto-cancel orders when flight is deleted', async () => {
    const user = seedUser();
    await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: '张三' }] });

    const res = await request(app).delete('/api/admin/flights/F1001').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.cancelledOrders).toBe(1);

    const myOrders = await request(app).get('/api/orders/my').set(authHeader(user));
    expect(myOrders.body[0].status).toBe('cancelled');
  });
});

describe('Admin User Management', () => {
  let admin;

  beforeEach(() => {
    admin = seedAdmin();
  });

  it('should list users', async () => {
    seedUser();
    const res = await request(app).get('/api/admin/users').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('should update user info', async () => {
    const user = seedUser();
    const res = await request(app).put(`/api/admin/users/${user.id}`).set(authHeader(admin))
      .send({ realName: 'New Name' });
    expect(res.status).toBe(200);
  });

  it('should delete a regular user', async () => {
    const user = seedUser();
    const res = await request(app).delete(`/api/admin/users/${user.id}`).set(authHeader(admin));
    expect(res.status).toBe(200);
  });

  it('should not delete admin user', async () => {
    const res = await request(app).delete(`/api/admin/users/${admin.id}`).set(authHeader(admin));
    expect(res.status).toBe(400);
  });
});

describe('Admin Order Management', () => {
  let admin;

  beforeEach(() => {
    admin = seedAdmin();
  });

  it('should change order status', async () => {
    const user = seedUser();
    const orderRes = await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

    const res = await request(app)
      .put(`/api/admin/orders/${orderRes.body.order.id}/status`)
      .set(authHeader(admin))
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('completed');
  });

  it('should reject invalid order status', async () => {
    const user = seedUser();
    const orderRes = await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

    const res = await request(app)
      .put(`/api/admin/orders/${orderRes.body.order.id}/status`)
      .set(authHeader(admin))
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });

  it('should approve a refund request', async () => {
    const user = seedUser();
    const orderRes = await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });
    const orderId = orderRes.body.order.id;

    await request(app).put(`/api/orders/${orderId}/refund-request`)
      .set(authHeader(user)).send({ reason: 'test' });

    const res = await request(app)
      .put(`/api/admin/orders/${orderId}/refund-approve`)
      .set(authHeader(admin))
      .send({ approved: true });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/通过/);
  });

  it('should reject a refund request', async () => {
    const user = seedUser();
    const orderRes = await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });
    const orderId = orderRes.body.order.id;

    await request(app).put(`/api/orders/${orderId}/refund-request`)
      .set(authHeader(user)).send({ reason: 'test' });

    const res = await request(app)
      .put(`/api/admin/orders/${orderId}/refund-approve`)
      .set(authHeader(admin))
      .send({ approved: false, rejectReason: '不符合退款条件' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/拒绝/);

    const myOrders = await request(app).get('/api/orders/my').set(authHeader(user));
    const order = myOrders.body.find(o => o.id === orderId);
    expect(order.status).toBe('paid');
  });

  it('should restore seats on refund approval', async () => {
    const user = seedUser();
    const orderRes = await request(app).post('/api/orders').set(authHeader(user))
      .send({ flightId: 'F1001', passengers: [{ name: 'A' }, { name: 'B' }] });
    const orderId = orderRes.body.order.id;

    await request(app).put(`/api/orders/${orderId}/refund-request`)
      .set(authHeader(user)).send({ reason: 'test' });

    await request(app).put(`/api/admin/orders/${orderId}/refund-approve`)
      .set(authHeader(admin)).send({ approved: true });

    const flightRes = await request(app).get('/api/flights/F1001');
    expect(flightRes.body.availableSeats).toBe(180);
  });
});
