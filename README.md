# 飞机票订票平台

一个简单的前后端交互飞机票订票系统，包含用户端和管理员后台。

## 功能

- 用户注册/登录（JWT 认证）
- 航班搜索与预订（支持出发地、目的地、日期筛选）
- 订单管理（查看订单、取消订单）
- 管理员后台（仪表盘统计、航班增删改查、用户管理、订单状态管理）

## 技术栈

- **前端**: HTML / CSS / JavaScript（原生）
- **后端**: Node.js + Express
- **数据存储**: JSON 文件
- **认证**: JWT + bcryptjs

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 访问 http://localhost:3000
```

## 管理员账号

- 用户名: `admin`
- 密码: `admin123`

## 项目结构

```
├── server.js              # Express 服务入口
├── routes/
│   ├── auth.js            # 认证路由（注册/登录）
│   ├── flights.js         # 航班路由（搜索/查询）
│   ├── orders.js          # 订单路由（创建/查询/取消）
│   └── admin.js           # 管理员路由（航班/用户/订单管理）
├── data/
│   └── seed-flights.js    # 初始航班数据
├── public/
│   ├── index.html         # 首页（航班搜索）
│   ├── login.html         # 登录页
│   ├── register.html      # 注册页
│   ├── search.html        # 航班搜索页
│   ├── booking.html       # 订票页
│   ├── orders.html        # 我的订单页
│   ├── admin.html         # 管理员后台
│   ├── css/style.css      # 样式
│   └── js/api.js          # API 工具库
└── package.json
```

## 开发过程

| 轮次 | 类型 | 描述 |
|------|------|------|
| round1 | feat | 完整平台搭建：用户认证、航班搜索、订票、订单管理、管理员后台 |
