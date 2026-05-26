# 部署文档

## 环境要求

- Node.js ≥ 18
- npm ≥ 9
- Docker ≥ 20（容器化部署）
- Git

## 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/TD-ding/flight-booking.git
cd flight-booking
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，设置 JWT 密钥：

```
JWT_SECRET=your-random-secret-key-here
PORT=3000
```

> 开发环境未设置 JWT_SECRET 时会使用默认值并输出警告，生产环境必须设置。

### 4. 启动服务

```bash
npm start
# 或
npm run dev
```

访问 http://localhost:3000

### 5. 代码检查

```bash
npm run lint
```

### 6. 运行测试

```bash
npm test
npm run test:coverage  # 带覆盖率报告
```

## Docker 部署

### 构建镜像

```bash
docker build -t flight-booking .
```

### 使用 docker-compose

1. 在项目根目录创建 `.env` 文件（或直接在 docker-compose.yml 中填写 environment）

2. 启动服务：

```bash
docker compose up -d
```

3. 查看日志：

```bash
docker compose logs -f
```

4. 停止服务：

```bash
docker compose down
```

### Docker 配置说明

**Dockerfile**

- 多阶段构建：第一阶段安装依赖（含 dev 依赖用于构建），第二阶段仅复制生产依赖和源码
- 使用 `node:20-alpine` 基础镜像
- 创建非 root 用户 `appuser` 运行应用
- 暴露端口 3000

**docker-compose.yml**

- 后端容器使用显式 `environment` 声明，不使用 `env_file`
- 环境变量通过 `${VAR}` 语法从宿主机 `.env` 文件或 shell 环境中读取
- 设置 `restart: unless-stopped` 自动重启

**.dockerignore**

排除 `node_modules/`、`data/*.json`、`.git/`、`.github/`、`coverage/`、`.env`，减小构建上下文。

## 数据初始化

首次启动时，`server.js` 自动完成以下初始化：

1. 创建 `data/` 目录（如不存在）
2. 初始化 JSON 数据文件：
   - `users.json` — 空数组
   - `flights.json` — 从 `data/seed-flights.js` 加载种子航班数据（12 条）
   - `orders.json` — 空数组
   - `notifications.json` — 空数组
3. 创建默认管理员账户：
   - 用户名：`admin`
   - 密码：`admin123`
   - 角色：`admin`

> 生产环境部署后请立即修改管理员密码。

## 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `JWT_SECRET` | 生产环境必需 | `dev-only-secret-key` | JWT 签名密钥，建议使用 32 位以上随机字符串 |
| `PORT` | 否 | `3000` | 服务监听端口 |
| `NODE_ENV` | 否 | — | 设为 `production` 时未配置 JWT_SECRET 会拒绝启动 |

### 生成安全的 JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## CI/CD

### CI 工作流（ci.yml）

**触发条件**：Pull Request 到 `master` 分支

**执行步骤**：
1. 检出代码
2. 安装 Node.js 20
3. `npm ci` 安装依赖
4. `npm run lint` 代码检查
5. `npm test` 运行测试

### CD 工作流（cd.yml）

**触发条件**：Push 到 `master` 分支

**执行步骤**：
1. 检出代码
2. 安装 Node.js 20
3. `npm ci` → `npm run lint` → `npm test`
4. 登录 Docker Hub（需要配置 GitHub Secrets）
5. 构建并推送 Docker 镜像

**需要配置的 GitHub Secrets**：

| Secret | 说明 |
|--------|------|
| `DOCKER_USERNAME` | Docker Hub 用户名 |
| `DOCKER_PASSWORD` | Docker Hub 访问令牌 |

镜像 tag 格式：`<DOCKER_USERNAME>/flight-booking:latest`

## 生产部署注意事项

1. **修改管理员密码**：首次部署后通过个人中心修改 `admin` 账户密码
2. **设置 JWT_SECRET**：使用强随机密钥，不要使用默认值
3. **数据持久化**：Docker 容器内的 `data/` 目录不持久化。如需持久化，挂载 volume：
   ```yaml
   services:
     backend:
       volumes:
         - ./data:/app/data
   ```
4. **反向代理**：建议在前面加 Nginx/Caddy 做 HTTPS 终止和负载均衡
5. **数据库**：当前使用 JSON 文件存储，适合小规模使用。如需高并发，建议迁移至数据库
6. **备份**：定期备份 `data/` 目录下的 JSON 文件
