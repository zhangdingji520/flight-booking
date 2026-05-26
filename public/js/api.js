const API = {
  baseUrl: '/api',

  async request(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(this.baseUrl + url, { ...options, headers });
    const data = await res.json();
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showToast('登录已过期，请重新登录', 'error');
      setTimeout(() => { window.location.href = '/login.html?redirect=' + encodeURIComponent(location.pathname + location.search); }, 1000);
      throw new Error('登录已过期');
    }
    if (!res.ok) throw new Error(data.message || '请求失败');
    return data;
  },

  register: (body) => API.request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => API.request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => API.request('/auth/me'),
  updateProfile: (body) => API.request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body) => API.request('/auth/password', { method: 'PUT', body: JSON.stringify(body) }),
  getProfileStats: () => API.request('/auth/profile/stats'),
  searchFlights: (params) => {
    const q = new URLSearchParams(params).toString();
    return API.request(`/flights/search?${q}`);
  },
  getFlight: (id) => API.request(`/flights/${id}`),
  getCities: () => API.request('/flights/search').then(flights => {
    const cities = new Set();
    flights.forEach(f => { cities.add(f.departure); cities.add(f.arrival); });
    return [...cities].sort();
  }),
  createOrder: (body) => API.request('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getMyOrders: () => API.request('/orders/my'),
  cancelOrder: (id) => API.request(`/orders/${id}/cancel`, { method: 'PUT' }),
  requestRefund: (id, reason) => API.request(`/orders/${id}/refund-request`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  getMyNotifications: () => API.request('/notifications/my'),
  markNotificationRead: (id) => API.request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => API.request('/notifications/read-all', { method: 'PUT' }),
  getAdminStats: () => API.request('/admin/stats'),
  getAdminFlights: () => API.request('/admin/flights'),
  addFlight: (body) => API.request('/admin/flights', { method: 'POST', body: JSON.stringify(body) }),
  updateFlight: (id, body) => API.request(`/admin/flights/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteFlight: (id) => API.request(`/admin/flights/${id}`, { method: 'DELETE' }),
  getAdminUsers: () => API.request('/admin/users'),
  updateUser: (id, body) => API.request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id) => API.request(`/admin/users/${id}`, { method: 'DELETE' }),
  getAdminOrders: () => API.request('/admin/orders'),
  updateOrderStatus: (id, status) => API.request(`/admin/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  approveRefund: (id, approved, rejectReason) => API.request(`/admin/orders/${id}/refund-approve`, { method: 'PUT', body: JSON.stringify({ approved, rejectReason }) }),
};

function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function fmtPrice(n) { return '¥' + Number(n).toFixed(2); }

function fmtDuration(depTime, arrTime) {
  const ms = new Date(arrTime) - new Date(depTime);
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
}

function seatClass(seats, total) {
  if (seats <= 0) return 'seat-low';
  if (total && seats / total <= 0.2) return 'seat-low';
  return 'seat-ok';
}

function showLoading(container) {
  container.innerHTML = '<div class="loading-container"><div class="spinner"></div><span>加载中...</span></div>';
}

function setBtnLoading(btn, loading) {
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> 提交中...';
    btn.style.opacity = '0.7';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.origText;
    btn.style.opacity = '';
  }
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function checkAuth() {
  const user = getUser();
  if (!user) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(location.pathname + location.search);
    return null;
  }
  return user;
}

function updateNavbar() {
  const user = getUser();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;
  const current = location.pathname;
  function navHref(href, text, extraClass) {
    const active = current === href ? ' active' : '';
    return `<a href="${href}" class="${extraClass || ''}${active}">${text}</a>`;
  }
  if (user) {
    const isAdmin = user.role === 'admin';
    navLinks.innerHTML = `
      ${navHref('/search.html', '搜索航班')}
      ${navHref('/orders.html', '我的订单')}
      ${isAdmin ? navHref('/admin.html', '管理后台') : ''}
      <a href="#" onclick="toggleNotifications(event)" style="position:relative;font-size:18px;padding:8px 12px" title="通知">
        🔔<span id="notif-badge" style="display:none;position:absolute;top:2px;right:4px;background:var(--danger);color:white;border-radius:50%;min-width:16px;height:16px;font-size:11px;line-height:16px;text-align:center;padding:0 4px"></span>
      </a>
      ${navHref('/profile.html', esc(user.realName || user.username))}
      <a href="#" onclick="logout()" class="btn btn-outline btn-sm">退出</a>
    `;
    if (user.role !== 'admin') loadNotifBadge();
  } else {
    navLinks.innerHTML = `
      ${navHref('/search.html', '搜索航班')}
      ${navHref('/login.html', '登录', 'btn btn-outline btn-sm')}
      ${navHref('/register.html', '注册', 'btn btn-primary btn-sm')}
    `;
  }
}

async function loadNotifBadge() {
  try {
    const data = await API.getMyNotifications();
    const badge = document.getElementById('notif-badge');
    if (badge && data.unreadCount > 0) {
      badge.style.display = '';
      badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
    }
  } catch {}
}

function toggleNotifications(e) {
  e.preventDefault();
  const existing = document.getElementById('notif-dropdown');
  if (existing) { existing.remove(); return; }
  const dropdown = document.createElement('div');
  dropdown.id = 'notif-dropdown';
  dropdown.style.cssText = 'position:fixed;top:60px;right:24px;width:360px;max-height:480px;overflow-y:auto;background:white;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);z-index:200;padding:16px';
  dropdown.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';
  document.body.appendChild(dropdown);
  API.getMyNotifications().then(data => {
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
    if (!data.notifications.length) {
      dropdown.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray-500)">暂无通知</div>';
      return;
    }
    dropdown.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong>通知</strong>
        <button onclick="markAllRead()" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:13px">全部已读</button>
      </div>
      ${data.notifications.map(n => `
        <div style="padding:12px;border-radius:8px;margin-bottom:8px;background:${n.read ? 'white' : '#f0f7ff'};border:1px solid var(--gray-200);cursor:pointer" onclick="markRead('${esc(n.id)}')">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:14px">${esc(n.title)}</strong>
            ${!n.read ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--primary);display:inline-block"></span>' : ''}
          </div>
          <div style="font-size:13px;color:var(--gray-700);margin-top:4px">${esc(n.content)}</div>
          <div style="font-size:12px;color:var(--gray-500);margin-top:4px">${new Date(n.createdAt).toLocaleString()}</div>
        </div>
      `).join('')}
    `;
  }).catch(() => { dropdown.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray-500)">加载失败</div>'; });
}

async function markRead(id) {
  try {
    await API.markNotificationRead(id);
    const el = document.querySelector(`[onclick="markRead('${id}')"]`);
    if (el) el.style.background = 'white';
  } catch {}
}

async function markAllRead() {
  try {
    await API.markAllNotificationsRead();
    toggleNotifications(null);
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
  } catch {}
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', updateNavbar);
document.addEventListener('click', e => {
  const dd = document.getElementById('notif-dropdown');
  if (dd && !dd.contains(e.target) && !e.target.closest('[onclick*="toggleNotifications"]')) dd.remove();
});
