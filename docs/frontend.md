# 前端文档

## 技术栈

- 原生 HTML5 + CSS3 + JavaScript（无框架）
- 单页应用（SPA），通过后端路由 fallback 到 `index.html` 实现

## 目录结构

```
public/
├── index.html          # 首页 — 航班搜索
├── login.html          # 登录页
├── register.html       # 注册页
├── search.html         # 搜索结果页
├── booking.html        # 预订页（填写乘客信息、确认支付）
├── orders.html         # 我的订单列表
├── profile.html        # 个人中心
├── admin.html          # 管理后台
├── css/
│   └── style.css       # 全局样式
└── js/
    └── api.js          # 公共模块（API 请求、工具函数、导航栏、通知）
```

## 页面说明

### 首页（index.html）

首页提供航班搜索功能：
- 出发/到达城市下拉选择（数据从 `/api/flights/search` 动态加载）
- 城市互换按钮
- 日期选择器
- 排序方式（默认 / 价格 / 时间）
- 搜索结果展示航班卡片，显示航线、时间、价格、余票状态
- 点击「立即预订」跳转至 booking.html，未登录时先跳转登录页并携带 redirect 参数

### 登录页（login.html）

- 用户名 + 密码登录
- 登录成功后将 token 和 user 存入 localStorage，跳回原页面（通过 URL 中的 redirect 参数）

### 注册页（register.html）

- 用户名（2-20 位）、密码（至少 6 位）、可选真实姓名/邮箱/手机号
- 注册成功自动登录并跳转首页

### 搜索页（search.html）

- 独立搜索结果页，与首页搜索逻辑相同
- 支持 URL 参数直接访问搜索结果

### 预订页（booking.html）

- 通过 URL 参数 `flightId` 获取航班信息
- 动态添加乘客（最多 5 位），每位乘客需填写姓名（必填）和身份证号（选填）
- 实时计算总价
- 确认弹窗展示完整订单信息
- 提交后跳转订单列表

### 订单列表（orders.html）

- 展示当前用户所有订单
- 状态筛选（全部 / 已支付 / 已完成 / 已取消 / 退款中 / 已退款）
- 操作按钮：取消订单、申请退款（仅已支付状态）
- 管理员可跳转管理后台

### 个人中心（profile.html）

- 查看订单统计（总订单 / 待出行 / 已完成 / 累计消费）
- 编辑基本信息（真实姓名、邮箱、手机号）
- 修改密码（需输入旧密码，新密码至少 6 位）

### 管理后台（admin.html）

- **数据面板**：用户数、航班数、订单数、收入、取消订单数、待退款数
- **航班管理**：添加/编辑/删除航班，修改航班状态，删除时显示受影响订单数
- **用户管理**：查看/编辑/删除用户（不可删除管理员）
- **订单管理**：查看所有订单、修改状态、审批退款（通过/拒绝）

## 公共模块（api.js）

### API 对象

封装所有后端 API 调用，自动附加 JWT token：

| 方法 | 端点 | 说明 |
|------|------|------|
| `API.register(body)` | POST `/api/auth/register` | 注册 |
| `API.login(body)` | POST `/api/auth/login` | 登录 |
| `API.getMe()` | GET `/api/auth/me` | 获取当前用户 |
| `API.updateProfile(body)` | PUT `/api/auth/profile` | 更新个人信息 |
| `API.changePassword(body)` | PUT `/api/auth/password` | 修改密码 |
| `API.getProfileStats()` | GET `/api/auth/profile/stats` | 获取个人统计 |
| `API.searchFlights(params)` | GET `/api/flights/search` | 搜索航班 |
| `API.getFlight(id)` | GET `/api/flights/:id` | 获取航班详情 |
| `API.getCities()` | GET `/api/flights/search` | 获取所有城市 |
| `API.createOrder(body)` | POST `/api/orders` | 创建订单 |
| `API.getMyOrders()` | GET `/api/orders/my` | 我的订单 |
| `API.cancelOrder(id)` | PUT `/api/orders/:id/cancel` | 取消订单 |
| `API.requestRefund(id, reason)` | PUT `/api/orders/:id/refund-request` | 申请退款 |
| `API.getMyNotifications()` | GET `/api/notifications/my` | 获取通知 |
| `API.markNotificationRead(id)` | PUT `/api/notifications/:id/read` | 标记已读 |
| `API.markAllNotificationsRead()` | PUT `/api/notifications/read-all` | 全部已读 |
| `API.getAdminStats()` | GET `/api/admin/stats` | 管理后台统计 |
| `API.getAdminFlights()` | GET `/api/admin/flights` | 航班列表 |
| `API.addFlight(body)` | POST `/api/admin/flights` | 添加航班 |
| `API.updateFlight(id, body)` | PUT `/api/admin/flights/:id` | 编辑航班 |
| `API.deleteFlight(id)` | DELETE `/api/admin/flights/:id` | 删除航班 |
| `API.getAdminUsers()` | GET `/api/admin/users` | 用户列表 |
| `API.updateUser(id, body)` | PUT `/api/admin/users/:id` | 编辑用户 |
| `API.deleteUser(id)` | DELETE `/api/admin/users/:id` | 删除用户 |
| `API.getAdminOrders()` | GET `/api/admin/orders` | 订单列表 |
| `API.updateOrderStatus(id, status)` | PUT `/api/admin/orders/:id/status` | 修改订单状态 |
| `API.approveRefund(id, approved, reason)` | PUT `/api/admin/orders/:id/refund-approve` | 审批退款 |

### 工具函数

| 函数 | 说明 |
|------|------|
| `esc(str)` | XSS 转义，通过 textContent 实现 HTML 实体编码 |
| `fmtPrice(n)` | 格式化价格为 `¥xxx.xx` |
| `fmtDuration(dep, arr)` | 计算飞行时长，返回如 `2h30m` |
| `seatClass(seats, total)` | 根据余票比例返回 CSS 类名（余票≤20%显示警告） |
| `showLoading(container)` | 在容器中显示加载动画 |
| `setBtnLoading(btn, loading)` | 按钮加载状态切换 |
| `showToast(message, type)` | 显示操作提示（success/error） |
| `getUser()` | 从 localStorage 获取当前用户信息 |
| `checkAuth()` | 检查登录状态，未登录跳转登录页 |
| `updateNavbar()` | 根据登录状态和角色渲染导航栏 |
| `loadNotifBadge()` | 加载通知未读数角标 |
| `toggleNotifications(e)` | 切换通知下拉面板 |
| `markRead(id)` | 标记单条通知已读 |
| `markAllRead()` | 标记所有通知已读 |
| `logout()` | 退出登录 |

### 认证流程

1. 注册/登录成功后，`token` 存入 `localStorage.token`，用户信息存入 `localStorage.user`
2. 所有 API 请求自动在 Authorization 头携带 `Bearer <token>`
3. 收到 401 响应时自动清除本地凭证并跳转登录页
4. 每个需认证页面通过 `checkAuth()` 校验登录状态

### 导航栏

- 自动根据当前 URL 高亮对应页面
- 普通用户：搜索航班 / 我的订单 / 通知 / 个人中心 / 退出
- 管理员额外显示：管理后台
- 未登录用户：搜索航班 / 登录 / 注册

## 样式

全局使用 CSS 变量定义主题色，主要变量：

| 变量 | 用途 |
|------|------|
| `--primary` | 主色调（蓝色 `#1a73e8`） |
| `--danger` | 警告/价格（红色） |
| `--gray-*` | 灰度梯度 |

响应式布局，主要组件样式：`.navbar`、`.card`、`.btn`、`.flight-card`、`.modal`、`.toast`、`.spinner`、`.stats-grid`。
