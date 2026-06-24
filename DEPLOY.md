# 郦邦武斗传部署指南

## 环境要求

- Node.js >= 18
- npm 或 yarn
- (可选) PM2 进程管理
- (可选) Nginx 反向代理

## 快速部署

### 1. 克隆项目

```bash
git clone https://github.com/AhsokaTano26/bang_fight.git
cd bang_fight
```

### 2. 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 3. 构建项目

```bash
# 构建后端
cd backend
npm run build

# 构建前端
cd ../frontend
npm run build
```

### 4. 启动服务

```bash
# 启动后端 (端口 3000)
cd backend
npm run start:prod

# 前端静态文件在 frontend/dist/ 目录
```

## 开发环境

### 启动开发服务器

```bash
# 终端 1：后端
cd backend
npm run start:dev

# 终端 2：前端
cd frontend
npm run dev
```

访问 `http://localhost:5173`

## 生产环境部署

### 方式一：直接运行

```bash
# 构建后端
cd backend
npm run build

# 启动后端
node dist/main.js
```

### 方式二：使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd backend
pm2 start dist/main.js --name "bang-fight-api"

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup

# 查看状态
pm2 status

# 查看日志
pm2 logs bang-fight-api
```

### 方式三：Docker

#### 后端 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 复制构建文件
COPY dist ./dist

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/main.js"]
```

#### 构建和运行

```bash
# 构建镜像
docker build -t bang-fight-api ./backend

# 运行容器
docker run -d -p 3000:3000 --name bang-fight-api bang-fight-api
```

## Nginx 配置

### 基础配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/bang_fight/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### HTTPS 配置 (Let's Encrypt)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 前端静态文件
    location / {
        root /path/to/bang_fight/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 环境变量

### 后端环境变量

创建 `.env` 文件在 `backend/` 目录：

```env
# 服务端口
PORT=3000

# 数据库配置 (未来)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=bang_fight

# Redis 配置 (未来多人对战)
# REDIS_HOST=localhost
# REDIS_PORT=6379
```

### 前端环境变量

创建 `.env` 文件在 `frontend/` 目录：

```env
# 后端 API 地址
VITE_API_BASE_URL=http://localhost:3000
```

## 常见问题

### 1. 端口被占用

```bash
# 查看端口占用
lsof -i :3000
lsof -i :5173

# 杀死进程
kill -9 <PID>
```

### 2. 依赖安装失败

```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 3. 构建失败

```bash
# 检查 Node.js 版本
node --version

# 确保版本 >= 18
```

### 4. 权限问题

```bash
# 修复 npm 权限
sudo chown -R $(whoami) ~/.npm

# 或使用 nvm 管理 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

## 性能优化

### 前端优化

- 启用 Gzip 压缩
- 使用 CDN 加速静态资源
- 启用浏览器缓存

### 后端优化

- 启用生产模式
- 使用 PM2 集群模式
- 配置负载均衡

```bash
# PM2 集群模式
pm2 start dist/main.js -i max --name "bang-fight-api"
```

## 监控和日志

### PM2 监控

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs

# 监控面板
pm2 monit
```

### Nginx 日志

```bash
# 查看访问日志
tail -f /var/log/nginx/access.log

# 查看错误日志
tail -f /var/log/nginx/error.log
```

## 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建
cd backend && npm run build
cd ../frontend && npm run build

# 重启后端
pm2 restart bang-fight-api

# 前端静态文件会自动更新
```

## 回滚

```bash
# 回滚到指定版本
git checkout <commit-hash>

# 重新构建
cd backend && npm run build
cd ../frontend && npm run build

# 重启服务
pm2 restart bang-fight-api
```
