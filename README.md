# 飞机票订票平台

一个功能完整的前后端交互飞机票订票系统，包含用户端和管理员后台。

## 功能

### 用户端
- 注册/登录（JWT 认证，密码 bcrypt 加密）
- 航班搜索（城市下拉选择、日期筛选、价格/时间排序、城市互换）
- 在线订票（多乘客、确认弹窗、实时价格计算、防重复提交）
- 订单管理（状态筛选、取消订单、申请退款、再次预订）
- 个人中心（信息编辑、密码修改、消费统计）
- 消息通知（航班变更、退款结果自动推送、未读红点提示）

### 管理员后台
- 仪表盘统计（用户数、航班数、订单数、收入）
- 航班管理（增删改查、状态变更自动联动关联订单）
- 用户管理（查看、编辑、搜索、删除）
- 订单管理（状态变更、退款审核、搜索筛选）
- 表格搜索、状态变更确认、受影响订单提示

### 技术亮点
- XSS 防护（前后端双重转义）
- JWT 密钥环境变量化，未配置拒绝启动
- 航班取消自动级联取消关联订单 + 释放座位 + 通知用户
- 79 个单元测试覆盖核心业务逻辑

## 技术栈

- **前端**: HTML / CSS / JavaScript（原生）
- **后端**: Node.js + Express
- **数据存储**: JSON 文件
- **认证**: JWT + bcryptjs
- **测试**: Jest + Supertest（79 tests）
- **Lint**: ESLint v9 flat config
- **容器化**: Docker + docker-compose
- **CI/CD**: GitHub Actions

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动服务
npm start

# 访问 http://localhost:3000
```

## Docker 部署

```bash
docker compose up --build
# 访问 http://localhost:3000
```

## 管理员账号

- 用户名: `admin`
- 密码: `admin123`

## 项目结构

```
├── server.js              # Express 服务入口
├── config.js              # 配置（JWT密钥、端口等）
├── db.js                  # 统一数据访问层
├── middleware/
│   ├── auth.js            # JWT 认证中间件
│   └── validate.js        # 输入验证中间件
├── routes/
│   ├── auth.js            # 认证路由（注册/登录/个人中心）
│   ├── flights.js         # 航班路由（搜索/查询）
│   ├── orders.js          # 订单路由（创建/查询/取消/退款申请）
│   ├── admin.js           # 管理员路由（航班/用户/订单/退款管理）
│   └── notifications.js   # 通知路由
├── services/
│   └── notify.js          # 通知服务
├── data/
│   └── seed-flights.js    # 初始航班数据
├── public/
│   ├── index.html         # 首页
│   ├── login.html         # 登录页
│   ├── register.html      # 注册页
│   ├── search.html        # 航班搜索页
│   ├── booking.html       # 订票页
│   ├── orders.html        # 我的订单页
│   ├── profile.html       # 个人中心
│   ├── admin.html         # 管理员后台
│   ├── css/style.css      # 样式
│   └── js/api.js          # API 工具库
├── test/                  # 单元测试
├── docs/                  # 项目文档
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 开发过程

| 轮次 | 类型 | 描述 | PR |
|------|------|------|----|
| 1 | feat | 完整平台搭建：认证、搜索、订票、订单、管理后台 + 安全加固 | #1 |
| 2 | refactor | 数据访问统一、UUID航班ID、座位联动、XSS防护、排序筛选 | #2 |
| 3 | feat | 确认弹窗、登录跳转、飞行时长、余票提示、订单筛选、导航高亮 | #3 |
| 4 | feat | 个人中心、通知系统、退款流程、管理员编辑用户、航班取消联动 | #4 |
| 5 | fix | 航班取消联动修复、退款状态检查、管理员铃铛、按钮恢复、验证 | #5 |
| - | infra | ESLint + 79测试 + Docker + CI/CD | #6 |
| - | docs | 前端/后端/部署文档 | #7 |

## License

MIT
