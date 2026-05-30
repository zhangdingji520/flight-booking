const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { JWT_SECRET } = require('../config');
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../db-supabase');

const router = express.Router();

// Helper to convert snake_case to camelCase
function toCamelCase(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    realName: row.real_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
    password: row.password
  };
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password, realName, email, phone } = req.body;
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
    if (password.length < 6) return res.status(400).json({ message: '密码至少6位' });
    if (username.length < 2 || username.length > 20) return res.status(400).json({ message: '用户名长度需在2-20之间' });

    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) return res.status(400).json({ message: '用户名已存在' });

    const newUser = {
      id: uuidv4(),
      username,
      password: bcrypt.hashSync(password, 10),
      real_name: realName || username,
      email: email || '',
      phone: phone || '',
      role: 'user'
    };

    const { data, error } = await supabase
      .from('users')
      .insert([newUser])
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign({ id: data.id, username: data.username, role: data.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      message: '注册成功',
      token,
      user: { id: data.id, username: data.username, realName: data.real_name, email: data.email, phone: data.phone, role: data.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: '注册失败' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username);

    if (error) throw error;
    const user = users[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      message: '登录成功',
      token,
      user: { id: user.id, username: user.username, realName: user.real_name, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: '登录失败' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ message: '用户不存在' });

    res.json({
      id: user.id,
      username: user.username,
      realName: user.real_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { realName, email, phone } = req.body;
    const updates = {};
    if (realName !== undefined) updates.real_name = realName;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!user) return res.status(404).json({ message: '用户不存在' });

    res.json({
      message: '更新成功',
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: '更新失败' });
  }
});

// Change password
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ message: '请输入旧密码和新密码' });
    if (newPassword.length < 6) return res.status(400).json({ message: '新密码至少6位' });

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password')
      .eq('id', req.user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!user) return res.status(404).json({ message: '用户不存在' });

    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ message: '旧密码不正确' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: bcrypt.hashSync(newPassword, 10) })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    res.json({ message: '密码修改成功' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: '密码修改失败' });
  }
});

// Profile stats
router.get('/profile/stats', authMiddleware, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('status, total_price')
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      totalOrders: orders.length,
      paidOrders: orders.filter(o => o.status === 'paid').length,
      completedOrders: orders.filter(o => o.status === 'completed').length,
      totalSpent: orders.filter(o => o.status === 'paid' || o.status === 'completed').reduce((sum, o) => sum + parseFloat(o.total_price), 0)
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: '获取统计失败' });
  }
});

module.exports = router;
