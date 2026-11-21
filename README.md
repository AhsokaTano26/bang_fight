# 邦邦武斗传 (Bang Bang Fight)

基于 BanG Dream! 宇宙的在线卡牌对战游戏，支持单人 vs AI 对战。

## 技术栈

- **前端**: Vue 3 + Vite + Pinia + TypeScript，Reka UI 交互组件、Lucide 图标
- **后端**: NestJS + TypeScript
- **对局通信**: HTTP API

## 功能特性

- 🎮 单人 vs AI 对战
- 🃏 V1.9 图鉴收录 50 张角色牌（10 个阵营）
- ⚔️ 28 张行动卡面（7 种类型）、74 张道具／即时牌
- 🎲 判定、摸牌、行动与弃牌阶段
- 🎯 近战概率判定系统
- 💀 角色技能系统
- 📊 实时战斗日志

## 快速开始

### 环境要求

- Node.js 20.19+ 或 22.12+（以当前 Vite 的 engines 为准）
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
│   └── src/game/          # 游戏逻辑模块
│       └── ai/           # 可观察局面、合法行动、效用评分与回归测试
├── data/              # V1.9 卡面数据与旧编号映射
├── scripts/           # 资源转换与同步校验
└── 卡牌资源包V1.9-test inside/  # 原始 PNG 资源（保留原样）
```

## 游戏规则

### 基本规则

- 玩家数量: 2-4 人，当前界面支持 1 名真人对战 1-3 名电脑
- 胜利条件: 最后存活的玩家获胜
- 玩家生命值: 10 (仅在没有部署角色时可被攻击)

### 回合流程

1. **判定阶段**: 结束待处理效果，进行概率判定
2. **摸牌阶段**: 摸 2 张牌，刷新角色 AP 和 HP
3. **行动阶段**: 部署角色、使用行动牌、使用技能、装备策略牌
4. **弃牌阶段**: 弃牌至手牌上限 (5 张，角色牌不计入)

### 卡牌类型

- **行动牌**: 攻击、破甲攻击、防御、格挡、回复、回复大、补充
- **角色牌**: 图鉴收录 50 个角色，10 个阵营
- **策略牌**: 图鉴收录 74 张（Cool / Happy / Powerful / Pure）
- **辅助牌**: 21 张，含组合技、假面、变身角色与特殊事件；另有 13 张状态与对战板素材

### 关键词

守护、无视守护、群攻、历战、免伤、不可选中、反击、地藏、扩散

### 负面效果

跳过摸牌阶段、跳过行动阶段、失去行动能力、破甲/无视护甲、缴械、虚弱、沉默

## API 接口

### 创建游戏

```
POST /game/create
Body: { playerCount: 1, aiCount: 1 }
Response: { success: boolean, gameId: string, state: GameState }
```

### 获取游戏状态

```
GET /game/:id/state
Response: { success: boolean, state: GameState }
```

### 执行操作

```
POST /game/:id/action
Body: { playerId: string, type: string, params: object }
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

### 验证

```bash
# 后端规则、决策与种子自对局测试
cd backend
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build

# 独立的 2／3／4 人种子自对局与卡牌守恒检查
node -r ts-node/register test/ai-smoke.cjs

# 前端类型检查、生产构建与浏览器回归
cd ../frontend
npm run build
npm run test:e2e
```

浏览器测试使用 Playwright Chromium；首次使用可运行 `npx playwright install chromium`。测试会启动 127.0.0.1:5173 的 Vite 和 3000 端口的已构建后端，因此先构建后端。截图和失败跟踪保存在系统临时目录 `bang-fight-playwright-results/`。测试包含真实创建／摸牌／电脑回合、弹窗键盘与焦点恢复、策略牌参数、切换模式的请求竞态、320-1280 像素布局，以及 axe 自动可访问性检查。

后端另提供 `npm run lint`、`npm run format`；两条命令都会修改文件，按需使用。

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
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## 界面与电脑决策

首页、模式选择、完整图鉴和牌桌使用统一的颜色、字体、间距与控件状态。弹窗和标签页使用 [Reka UI](https://reka-ui.com/docs/components/dialog)，处理键盘导航、焦点约束与 Escape；卡牌选择和查看详情使用独立按钮，手机无需悬停即可查看。页面按功能异步加载，首页只读取轻量资源摘要，遵循 [Vue 性能指南](https://vuejs.org/guide/best-practices/performance)。

电脑采用 Utility AI：枚举可执行行动，比较收益和成本，执行一次后根据新局面重新评估。它只读取自己的手牌和公开区域，不读取对手手牌身份或牌堆顺序；失败、无进展和整回合次数都有边界。真人与电脑使用相同规则入口。算法选择参考 [Game AI Pro 的 Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf)，具体分值是明确记录的游戏启发式，尚未进行对照胜率标定。

已支持行动、计分假设、未建模技能及复现命令见 [电脑决策说明](backend/src/game/ai/README.md)。没有实际结算支持或无法可靠估值的效果不虚构收益；本次优化不扩展 V1.9 新技能的实战效果。

## 卡牌数据

新版卡面数据统一维护在 `data/cards-v1.9.json`，包含全部 186 项资源的名称、数值、技能文字、分类和旧编号映射。前后端的 `card-catalog.generated.ts` 由脚本生成，避免两端数据不一致。

图鉴收录完整 V1.9 卡牌。当前对战仍使用已支持的 20 张角色牌及原有牌组／技能结算；同步新版名称、印刷数值和图片，不将尚未实现技能的新增卡牌放入对战牌库。原有运行时编号保持兼容。

网页仅使用 `frontend/public/cards/v1.9/` 内的 WebP：卡面大图采用无损压缩，超大对战板的最长边限制为 2400 像素；手牌和图鉴列表使用最大 384×536 像素的缩略图，点击预览才加载大图。原始 PNG 保留在 `卡牌资源包V1.9-test inside/`；旧版 `内测1.0卡牌组/` 可从 Git 历史查阅。

修改数据或原始图片后，安装 `cwebp`（macOS：`brew install webp`），在仓库根目录执行：

```bash
node scripts/sync-card-pack.mjs          # 转换图片，同步前后端数据；未变化的图片复用缓存
node scripts/sync-card-pack.mjs --check  # 校验完整性、源文件和 WebP 哈希、两端生成数据
```

生成后的 WebP 和 TypeScript 文件随项目保存，正常构建、运行及 Docker 部署无需安装图片转换工具。旧版 AI 胜率数据不会显示在新版图鉴中；新统计必须标记 `cardPackVersion: "V1.9-test inside"`。

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目仅供学习和研究使用。卡牌图片版权归 BanG Dream! 所有。
