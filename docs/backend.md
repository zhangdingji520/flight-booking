# 后端文档

## 技术栈

- Node.js + Express 4
- JSON 文件存储（`data/` 目录）
- JWT（jsonwebtoken）认证
- bcryptjs 密码哈希

## 目录结构

```
├── server.js            # 入口：Express 应用、中间件、路由挂载、SPA fallback
├── config.js            # 配置：JWT_SECRET、PORT、合法状态值
├── db.js                # 数据访问：JSON 文件读写
├── middleware/
│   ├── auth.js          # 认证中间件：authMiddleware / adminAuth
│   └── validate.js      # 校验中间件：validateFlight / validateOrderStatus
├── routes/
│   ├── auth.js          # 认证路由：注册、登录、用户信息、密码修改
│   ├── flights.js       # 航班路由：搜索、列表、详情
│   ├── orders.js        # 订单路由：创建、查看、取消、退款申请
│   ├── admin.js         # 管理路由：航班/用户/订单管理、退款审批
│   └── notifications.js # 通知路由：获取、标记已读、全部已读
├── services/
│   └── notify.js        # 通知服务：创建通知、按航班通知用户
├── data/
│   ├── seed-flights.js  # 种子航班数据
│   ├── users.json       # 用户数据（运行时生成）
│   ├── flights.json     # 航班数据（初始化自种子数据）
│   ├── orders.json      # 订单数据（运行时生成）
│   └── notifications.json # 通知数据（运行时生成）
└── test/                # 测试目录
    ├── setup.js         # 测试辅助：数据重置、用户种子、token 生成
    ├── auth.test.js     # 认证测试
    ├── orders.test.js   # 订单测试
    ├── admin.test.js    # 管理功能测试
    └── validation.test.js # 校验测试
```

## 配置（config.js）

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|---------|--------|------|
| `JWT_SECRET` | `JWT_SECRET` | dev-only-secret-key | 生产环境必须设置 |
| `PORT` | `PORT` | 3000 | 服务端口 |
| `VALID_ORDER_STATUSES` | — | `['paid', 'completed', 'cancelled', 'refunded', 'refund_pending']` | 合法订单状态 |
| `VALID_FLIGHT_STATUSES` | — | `['on-time', 'delayed', 'cancelled']` | 合法航班状态 |

配置从 `.env` 文件加载环境变量（不依赖第三方库）。

## 数据访问层（db.js）

提供两个函数操作 `data/` 目录下的 JSON 文件：

- `read(name)` — 读取并解析 JSON 文件
- `write(name, data)` — 序列化并写入 JSON 文件

## 中间件

### auth.js

| 中间件 | 说明 |
|--------|------|
| `authMiddleware` | 校验 Authorization 头的 JWT，解码后挂载 `req.user`（id, username, role） |
| `adminAuth` | 在 authMiddleware 基础上额外检查 `role === 'admin'`，非管理员返回 403 |

### validate.js

| 中间件 | 说明 |
|--------|------|
| `validateFlight` | 校验航班字段：航班号、航空公司、出发/到达城市、时间逻辑、票价>0、座位数正整数、机型、状态白名单 |
| `validateOrderStatus` | 校验订单状态是否在 `VALID_ORDER_STATUSES` 白名单内 |

## API 路由

### 认证 `/api/auth`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/register` | 无 | 注册，用户名 2-20 位，密码 ≥ 6 位，返回 token + user |
| POST | `/login` | 无 | 登录，返回 token + user |
| GET | `/me` | 用户 | 获取当前用户信息 |
| PUT | `/profile` | 用户 | 更新个人信息（realName, email, phone） |
| PUT | `/password` | 用户 | 修改密码（需验证旧密码，新密码 ≥ 6 位） |
| GET | `/profile/stats` | 用户 | 获取个人订单统计 |

### 航班 `/api/flights`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/search` | 无 | 搜索航班，支持参数：`departure`、`arrival`、`date`、`sort`（price/time） |
| GET | `/` | 无 | 获取所有航班（含已取消） |
| GET | `/:id` | 无 | 获取单个航班详情 |

搜索自动过滤已取消航班。sort=price 按价格升序，sort=time 按出发时间升序。

### 订单 `/api/orders`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/` | 用户 | 创建订单（1-5 位乘客，扣减余票） |
| GET | `/my` | 用户 | 获取我的订单列表 |
| PUT | `/:id/cancel` | 用户 | 取消订单（已支付/已完成→cancelled，恢复余票） |
| PUT | `/:id/refund-request` | 用户 | 申请退款（paid→refund_pending，需填写原因） |

用户只能操作自己的订单。取消/退款对已取消、已退款、退款审核中的订单有状态限制。

### 管理 `/api/admin`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/stats` | 管理员 | 数据面板统计 |
| GET | `/flights` | 管理员 | 航班列表 |
| POST | `/flights` | 管理员 | 添加航班（经 validateFlight 校验） |
| PUT | `/flights/:id` | 管理员 | 编辑航班（自动同步 availableSeats，航班取消时自动取消关联订单并通知） |
| DELETE | `/flights/:id` | 管理员 | 删除航班（自动取消关联订单并通知） |
| GET | `/flights/:id/orders-count` | 管理员 | 获取航班关联的活跃订单数（用于删除确认） |
| GET | `/users` | 管理员 | 用户列表（不含密码） |
| PUT | `/users/:id` | 管理员 | 编辑用户信息（realName, email, phone, role） |
| DELETE | `/users/:id` | 管理员 | 删除用户（不可删除管理员） |
| GET | `/orders` | 管理员 | 订单列表（含用户名） |
| PUT | `/orders/:id/status` | 管理员 | 修改订单状态（经 validateOrderStatus 校验） |
| PUT | `/orders/:id/refund-approve` | 管理员 | 审批退款（approved=true→refunded+恢复余票，false→恢复为 paid） |

#### 航班编辑的 availableSeats 计算

编辑航班修改 `totalSeats` 时，系统计算已售座位数（`旧totalSeats - 旧availableSeats`），然后设置 `新availableSeats = max(0, 新totalSeats - 已售)`。

#### 航班取消/删除的级联操作

航班状态改为 `cancelled` 或删除航班时：
1. 查找该航班所有 `paid` 和 `refund_pending` 状态的订单
2. 将这些订单状态改为 `cancelled`
3. 为每个受影响用户创建通知

### 通知 `/api/notifications`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/my` | 用户 | 获取我的通知列表 + 未读数 |
| PUT | `/:id/read` | 用户 | 标记单条已读 |
| PUT | `/read-all` | 用户 | 标记全部已读 |

## 通知服务（notify.js）

| 函数 | 说明 |
|------|------|
| `createNotification(userId, type, title, content)` | 为指定用户创建通知 |
| `notifyUsersByFlight(flightId, type, title, content)` | 为指定航班的所有 paid 订单用户创建通知（去重） |

通知触发场景：
- 航班状态改为延误 → 通知该航班所有 paid 用户
- 航班取消/删除 → 自动取消关联订单并通知用户
- 退款审批通过/拒绝 → 通知用户审批结果

## 安全措施

| 措施 | 实现 |
|------|------|
| 密码存储 | bcryptjs 哈希（salt rounds = 10） |
| 认证 | JWT Bearer Token，24h 过期 |
| XSS 防护 | 服务端 `sanitize()` 函数转义 `< > " '` |
| CORS 限制 | 中间件检查 Origin 头与 Host 是否一致，拒绝跨域 API 请求 |
| 输入校验 | 航班创建/编辑和订单状态修改经过中间件校验 |
| 生产环境保护 | 生产环境未设置 JWT_SECRET 时拒绝启动 |

## 数据模型

### User

```json
{
  "id": "uuid",
  "username": "string",
  "password": "bcrypt hash",
  "realName": "string",
  "email": "string",
  "phone": "string",
  "role": "user | admin",
  "createdAt": "ISO 8601"
}
```

### Flight

```json
{
  "id": "F + UUID前6位",
  "flightNo": "string",
  "airline": "string",
  "departure": "string",
  "arrival": "string",
  "departureTime": "YYYY-MM-DD HH:mm",
  "arrivalTime": "YYYY-MM-DD HH:mm",
  "price": "number > 0",
  "totalSeats": "integer > 0",
  "availableSeats": "integer ≥ 0",
  "aircraft": "string",
  "status": "on-time | delayed | cancelled"
}
```

### Order

```json
{
  "id": "ORD-UUID前8位",
  "userId": "string",
  "flightId": "string",
  "flightNo": "string",
  "airline": "string",
  "departure": "string",
  "arrival": "string",
  "departureTime": "string",
  "arrivalTime": "string",
  "passengers": [{ "name": "string", "idCard": "string" }],
  "totalPrice": "number",
  "unitPrice": "number",
  "status": "paid | completed | cancelled | refunded | refund_pending",
  "refundReason": "string (仅 refund_pending)",
  "refundRequestedAt": "ISO 8601 (仅 refund_pending)",
  "createdAt": "ISO 8601"
}
```

### Notification

```json
{
  "id": "N-timestamp-random",
  "userId": "string",
  "type": "string",
  "title": "string",
  "content": "string",
  "read": "boolean",
  "createdAt": "ISO 8601"
}
```

## 测试

使用 Jest + supertest 进行集成测试，共 79 个测试用例：

| 测试文件 | 覆盖范围 |
|---------|---------|
| `test/auth.test.js` | 注册（校验、重复）、登录（成功、失败、缺字段）、用户信息、密码修改 |
| `test/orders.test.js` | 创建订单（多乘客、余票扣减、各种错误）、取消（恢复余票、权限隔离）、退款申请（重复申请、状态限制） |
| `test/admin.test.js` | 权限控制（普通用户被拒绝）、航班 CRUD、航班取消级联、用户管理、订单状态管理、退款审批（通过/拒绝/恢复余票） |
| `test/validation.test.js` | 航班字段校验（缺字段、时间逻辑、价格、座位数、状态白名单、XSS 过滤）、搜索过滤排序、订单状态白名单 |

运行命令：

```bash
npm test              # 运行测试
npm run test:coverage # 运行测试并生成覆盖率报告
```
