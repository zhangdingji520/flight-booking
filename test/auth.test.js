const request = require('supertest');
const app = require('../server');
const { resetData, seedUser, authHeader } = require('./setup');

beforeEach(() => {
  resetData();
});

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('newuser');
      expect(res.body.user.role).toBe('user');
    });

    it('should reject missing username or password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'test' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/密码/);
    });

    it('should reject password shorter than 6 chars', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/6/);
    });

    it('should reject username shorter than 2 chars', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'a', password: '123456' });
      expect(res.status).toBe(400);
    });

    it('should reject duplicate username', async () => {
      seedUser({ username: 'taken' });
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'taken', password: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/已存在/);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      seedUser({ username: 'loginuser', password: 'password123' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('loginuser');
    });

    it('should reject wrong password', async () => {
      seedUser({ username: 'loginuser', password: 'password123' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'loginuser', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nouser', password: '123456' });
      expect(res.status).toBe(401);
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const user = seedUser();
      const res = await request(app)
        .get('/api/auth/me')
        .set(authHeader(user));
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(user.username);
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set({ Authorization: 'Bearer invalidtoken' });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update profile', async () => {
      const user = seedUser();
      const res = await request(app)
        .put('/api/auth/profile')
        .set(authHeader(user))
        .send({ realName: 'Updated Name', email: 'new@test.com', phone: '13911111111' });
      expect(res.status).toBe(200);
      expect(res.body.user.realName).toBe('Updated Name');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should change password with correct old password', async () => {
      const user = seedUser({ password: 'oldpass123' });
      const res = await request(app)
        .put('/api/auth/password')
        .set(authHeader(user))
        .send({ oldPassword: 'oldpass123', newPassword: 'newpass123' });
      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: user.username, password: 'newpass123' });
      expect(loginRes.status).toBe(200);
    });

    it('should reject wrong old password', async () => {
      const user = seedUser({ password: 'oldpass123' });
      const res = await request(app)
        .put('/api/auth/password')
        .set(authHeader(user))
        .send({ oldPassword: 'wrongpass', newPassword: 'newpass123' });
      expect(res.status).toBe(400);
    });

    it('should reject new password shorter than 6 chars', async () => {
      const user = seedUser({ password: 'oldpass123' });
      const res = await request(app)
        .put('/api/auth/password')
        .set(authHeader(user))
        .send({ oldPassword: 'oldpass123', newPassword: '12345' });
      expect(res.status).toBe(400);
    });
  });
});
