# 邦邦武斗传 (Bang Bang Fight)

基于 BanG Dream! 宇宙的在线卡牌对战游戏，支持单人 vs AI 对战。

## 技术栈

- **前端**: Vue 3 + Vite + Pinia + TypeScript + TailwindCSS
- **后端**: NestJS + TypeScript
- **实时通信**: Socket.io (未来多人对战)

## 功能特性

- 🎮 单人 vs AI 对战
- 🃏 20 个角色卡牌 (5 个阵营)
- ⚔️ 28 种行动卡牌 (7 种类型)
- 🎲 完整的游戏机制 (判定、摸牌、行动、弃牌)
- 🎯 近战概率判定系统
- 💀 角色技能系统
- 📊 实时战斗日志

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动服务

```bash
# 启动后端服务 (默认端口 3000)
cd backend
npm run start:dev

# 启动前端服务 (默认端口 5173)
cd frontend
npm run dev
```

### 访问应用

打开浏览器访问 `http://localhost:5173`

## 项目结构

```
bang_fight/
├── frontend/          # Vue 3 前端应用
│   ├── src/
│   │   ├── components/    # Vue 组件
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── types/         # TypeScript 类型定义
│   │   └── composables/   # Vue 组合式函数
│   └── public/
│       └── cards/         # 卡牌图片
├── backend/           # NestJS 后端服务
│   └── src/
│       ├── game/          # 游戏逻辑模块
│       ├── card/          # 卡牌数据模块
│       ├── ai/            # AI 对战模块
│       └── player/        # 玩家管理模块
└── 内测1.0卡牌组/     # 原始卡牌图片资源
```

## 游戏规则

### 基本规则

- 玩家数量: 2-4 人 (v1.0 支持最多 3 人)
- 胜利条件: 最后存活的玩家获胜
- 玩家生命值: 10 (仅在没有部署角色时可被攻击)

### 回合流程

1. **判定阶段**: 结束待处理效果，进行概率判定
2. **摸牌阶段**: 摸 2 张牌，刷新角色 AP 和 HP
3. **行动阶段**: 部署角色、使用行动牌、使用技能、装备策略牌
4. **弃牌阶段**: 弃牌至手牌上限 (5 张，角色牌不计入)

### 卡牌类型

- **行动牌**: 攻击、破甲攻击、防御、格挡、回复、回复大、补充
- **角色牌**: 20 个角色，5 个阵营
- **策略牌**: 64 张 (A-D 系列)
- **辅助牌**: 特殊状态追踪卡

### 关键词

守护、无视守护、群攻、历战、免伤、不可选中、反击、地藏、扩散

### 负面效果

跳过摸牌阶段、跳过行动阶段、失去行动能力、破甲/无视护甲、缴械、虚弱、沉默

## API 接口

### 创建游戏

```
POST /game/create
Body: { playerCount: 2 }
Response: { gameId: string, state: GameState }
```

### 获取游戏状态

```
GET /game/:id/state
Response: GameState
```

### 执行操作

```
POST /game/:id/action
Body: { playerId: string, action: string, params?: object }
Response: { success: boolean, state: GameState }
```

### AI 回合

```
POST /game/:id/ai-turn
Response: { success: boolean, state: GameState }
```

## 开发指南

### 前端开发

```bash
cd frontend
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览构建结果
```

### 后端开发

```bash
cd backend
npm run start:dev    # 启动开发服务器
npm run build        # 构建生产版本
npm run start:prod   # 启动生产服务器
```

### 代码规范

```bash
# 前端
cd frontend
npm run lint         # 检查代码规范
npm run format       # 格式化代码

# 后端
cd backend
npm run lint         # 检查代码规范
npm run format       # 格式化代码
```

## 部署指南

### 前端部署

```bash
cd frontend
npm run build        # 构建生产版本
# 将 dist/ 目录部署到 Web 服务器
```

### 后端部署

```bash
cd backend
npm run build        # 构建生产版本
npm run start:prod   # 启动生产服务器
```

### Docker 部署 (可选)

```bash
# 后端 Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## 卡牌数据

所有卡牌数据定义在 `frontend/src/types/cards-data.ts` 和 `backend/src/game/character-data.ts` 中。

卡牌图片位于 `frontend/public/cards/` 目录，原始资源在 `内测1.0卡牌组/` 目录。

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目仅供学习和研究使用。卡牌图片版权归 BanG Dream! 所有。
