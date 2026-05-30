const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../db-supabase');

const router = express.Router();

// Helper to convert notification row to camelCase
function toNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    read: row.read,
    createdAt: row.created_at
  };
}

// Get my notifications
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const notifications = data.map(toNotification);
    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: '获取通知失败' });
  }
});

// Mark one as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: '通知不存在' });

    res.json({ message: '已标记已读' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: '标记已读失败' });
  }
});

// Mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;

    res.json({ message: '全部已读' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: '标记全部已读失败' });
  }
});

module.exports = router;
