const API = {
  baseUrl: '/api',

  async request(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(this.baseUrl + url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '请求失败');
    return data;
  },

  // Auth
  register: (body) => API.request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => API.request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => API.request('/auth/me'),

  // Flights
  searchFlights: (params) => {
    const q = new URLSearchParams(params).toString();
    return API.request(`/flights/search?${q}`);
  },
  getFlight: (id) => API.request(`/flights/${id}`),

  // Orders
  createOrder: (body) => API.request('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getMyOrders: () => API.request('/orders/my'),
  cancelOrder: (id) => API.request(`/orders/${id}/cancel`, { method: 'PUT' }),

  // Admin
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
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

function updateNavbar() {
  const user = getUser();
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;
  if (user) {
    const isAdmin = user.role === 'admin';
    navLinks.innerHTML = `
      <a href="/search.html">搜索航班</a>
      <a href="/orders.html">我的订单</a>
      ${isAdmin ? '<a href="/admin.html">管理后台</a>' : ''}
      <span style="color:var(--gray-500);font-size:14px;padding:8px">${user.realName || user.username}</span>
      <a href="#" onclick="logout()" class="btn btn-outline btn-sm">退出</a>
    `;
  } else {
    navLinks.innerHTML = `
      <a href="/search.html">搜索航班</a>
      <a href="/login.html" class="btn btn-outline btn-sm">登录</a>
      <a href="/register.html" class="btn btn-primary btn-sm">注册</a>
    `;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Auto init navbar
document.addEventListener('DOMContentLoaded', updateNavbar);
