const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Get my notifications
router.get('/my', authMiddleware, (req, res) => {
  const notifications = db.read('notifications.json')
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ notifications, unreadCount });
});

// Mark one as read
router.put('/:id/read', authMiddleware, (req, res) => {
  const notifications = db.read('notifications.json');
  const n = notifications.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (!n) return res.status(404).json({ message: '通知不存在' });
  n.read = true;
  db.write('notifications.json', notifications);
  res.json({ message: '已标记已读' });
});

// Mark all as read
router.put('/read-all', authMiddleware, (req, res) => {
  const notifications = db.read('notifications.json');
  notifications.filter(n => n.userId === req.user.id).forEach(n => n.read = true);
  db.write('notifications.json', notifications);
  res.json({ message: '全部已读' });
});

module.exports = router;
