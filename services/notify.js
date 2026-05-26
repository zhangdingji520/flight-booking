const db = require('../db');

function createNotification(userId, type, title, content) {
  const notifications = db.read('notifications.json');
  notifications.push({
    id: 'N-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
    userId,
    type,
    title,
    content,
    read: false,
    createdAt: new Date().toISOString()
  });
  db.write('notifications.json', notifications);
}

function notifyUsersByFlight(flightId, type, title, content) {
  const orders = db.read('orders.json');
  const affectedOrders = orders.filter(o => o.flightId === flightId && o.status === 'paid');
  const notified = new Set();
  for (const order of affectedOrders) {
    if (!notified.has(order.userId)) {
      createNotification(order.userId, type, title, content);
      notified.add(order.userId);
    }
  }
}

module.exports = { createNotification, notifyUsersByFlight };
