const request = require('supertest');
const app = require('../server');
const { resetData, seedUser, authHeader } = require('./setup');

beforeEach(() => {
  resetData();
});

describe('Order Routes', () => {
  describe('POST /api/orders - Create order', () => {
    it('should create an order for a valid flight', async () => {
      const user = seedUser();
      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({
          flightId: 'F1001',
          passengers: [{ name: '张三', idCard: '110101199001011234' }]
        });
      expect(res.status).toBe(200);
      expect(res.body.order.flightNo).toBe('CA1234');
      expect(res.body.order.status).toBe('paid');
      expect(res.body.order.totalPrice).toBe(980);
      expect(res.body.order.passengers).toHaveLength(1);
    });

    it('should deduct available seats', async () => {
      const user = seedUser();
      await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: '张三' }] });

      const flightRes = await request(app).get('/api/flights/F1001');
      expect(flightRes.body.availableSeats).toBe(179);
    });

    it('should create order with multiple passengers', async () => {
      const user = seedUser();
      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({
          flightId: 'F1001',
          passengers: [{ name: '张三' }, { name: '李四' }]
        });
      expect(res.status).toBe(200);
      expect(res.body.order.totalPrice).toBe(980 * 2);
    });

    it('should reject more than 5 passengers', async () => {
      const user = seedUser();
      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({
          flightId: 'F1001',
          passengers: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }, { name: 'F' }]
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/5/);
    });

    it('should reject empty passengers', async () => {
      const user = seedUser();
      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [] });
      expect(res.status).toBe(400);
    });

    it('should reject passenger without name', async () => {
      const user = seedUser();
      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: '' }] });
      expect(res.status).toBe(400);
    });

    it('should reject non-existent flight', async () => {
      const user = seedUser();
      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({ flightId: 'F9999', passengers: [{ name: '张三' }] });
      expect(res.status).toBe(404);
    });

    it('should reject cancelled flight', async () => {
      const user = seedUser();
      const fs = require('fs');
      const path = require('path');
      const flights = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'flights.json'), 'utf8'));
      const f = flights.find(fl => fl.id === 'F1001');
      f.status = 'cancelled';
      fs.writeFileSync(path.join(__dirname, '..', 'data', 'flights.json'), JSON.stringify(flights, null, 2));

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: '张三' }] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/取消/);
    });

    it('should reject when not enough seats', async () => {
      const user = seedUser();
      const fs = require('fs');
      const path = require('path');
      const flights = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'flights.json'), 'utf8'));
      const f = flights.find(fl => fl.id === 'F1001');
      f.availableSeats = 1;
      fs.writeFileSync(path.join(__dirname, '..', 'data', 'flights.json'), JSON.stringify(flights, null, 2));

      const res = await request(app)
        .post('/api/orders')
        .set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }, { name: 'B' }] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/余票/);
    });

    it('should require auth', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ flightId: 'F1001', passengers: [{ name: '张三' }] });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/orders/my', () => {
    it('should return only current user orders', async () => {
      const user1 = seedUser({ id: 'user-001', username: 'user1' });
      const user2 = seedUser({ id: 'user-002', username: 'user2' });

      await request(app).post('/api/orders').set(authHeader(user1))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });
      await request(app).post('/api/orders').set(authHeader(user2))
        .send({ flightId: 'F1002', passengers: [{ name: 'B' }] });

      const res = await request(app).get('/api/orders/my').set(authHeader(user1));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].userId).toBe('user-001');
    });
  });

  describe('PUT /api/orders/:id/cancel', () => {
    it('should cancel a paid order', async () => {
      const user = seedUser();
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: '张三' }] });
      const orderId = orderRes.body.order.id;

      const res = await request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set(authHeader(user));
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('cancelled');
    });

    it('should restore seats on cancel', async () => {
      const user = seedUser();
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }, { name: 'B' }] });
      const orderId = orderRes.body.order.id;

      await request(app).put(`/api/orders/${orderId}/cancel`).set(authHeader(user));

      const flightRes = await request(app).get('/api/flights/F1001');
      expect(flightRes.body.availableSeats).toBe(180);
    });

    it('should not cancel another users order', async () => {
      const user1 = seedUser({ id: 'user-001', username: 'user1' });
      const user2 = seedUser({ id: 'user-002', username: 'user2' });
      const orderRes = await request(app).post('/api/orders').set(authHeader(user1))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

      const res = await request(app)
        .put(`/api/orders/${orderRes.body.order.id}/cancel`)
        .set(authHeader(user2));
      expect(res.status).toBe(404);
    });

    it('should reject cancelling already cancelled order', async () => {
      const user = seedUser();
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });
      const orderId = orderRes.body.order.id;

      await request(app).put(`/api/orders/${orderId}/cancel`).set(authHeader(user));
      const res = await request(app).put(`/api/orders/${orderId}/cancel`).set(authHeader(user));
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/orders/:id/refund-request', () => {
    it('should submit refund request for paid order', async () => {
      const user = seedUser();
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

      const res = await request(app)
        .put(`/api/orders/${orderRes.body.order.id}/refund-request`)
        .set(authHeader(user))
        .send({ reason: '行程变更' });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('refund_pending');
    });

    it('should reject duplicate refund request', async () => {
      const user = seedUser();
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

      await request(app).put(`/api/orders/${orderRes.body.order.id}/refund-request`)
        .set(authHeader(user)).send({ reason: '原因1' });

      const res = await request(app).put(`/api/orders/${orderRes.body.order.id}/refund-request`)
        .set(authHeader(user)).send({ reason: '原因2' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/已提交/);
    });

    it('should reject refund without reason', async () => {
      const user = seedUser();
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });

      const res = await request(app)
        .put(`/api/orders/${orderRes.body.order.id}/refund-request`)
        .set(authHeader(user))
        .send({ reason: '' });
      expect(res.status).toBe(400);
    });

    it('should reject refund for cancelled order', async () => {
      const user = seedUser();
      const orderRes = await request(app).post('/api/orders').set(authHeader(user))
        .send({ flightId: 'F1001', passengers: [{ name: 'A' }] });
      await request(app).put(`/api/orders/${orderRes.body.order.id}/cancel`).set(authHeader(user));

      const res = await request(app)
        .put(`/api/orders/${orderRes.body.order.id}/refund-request`)
        .set(authHeader(user))
        .send({ reason: '想要退款' });
      expect(res.status).toBe(400);
    });
  });
});
