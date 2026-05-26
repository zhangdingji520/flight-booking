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
};

function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function fmtPrice(n) {
  return '¥' + Number(n).toFixed(2);
}

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
      <span style="color:var(--gray-500);font-size:14px;padding:8px">${esc(user.realName || user.username)}</span>
      <a href="#" onclick="logout()" class="btn btn-outline btn-sm">退出</a>
    `;
  } else {
    navLinks.innerHTML = `
      ${navHref('/search.html', '搜索航班')}
      ${navHref('/login.html', '登录', 'btn btn-outline btn-sm')}
      ${navHref('/register.html', '注册', 'btn btn-primary btn-sm')}
    `;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', updateNavbar);
