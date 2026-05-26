const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: '请先登录' });
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'token 无效或已过期' });
  }
}

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: '请先登录' });
  try {
    const decoded = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: '需要管理员权限' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'token 无效或已过期' });
  }
}

module.exports = { authMiddleware, adminAuth };
