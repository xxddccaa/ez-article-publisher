# 快速启动指南

## 项目概述

本项目是一个基于 **Turborepo Monorepo** 架构的完整解决方案，将 **Nuxt 3 前端** 和 **Nest.js 后端** 集成在一起，实现通过点击前端按钮执行 **Playwright** 浏览器自动化测试，并通过 **WebSocket** 实时展示测试过程。

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│           用户浏览器 (http://localhost:3000)         │
│  ┌─────────────────────────────────────────────────┐
│  │           Nuxt 3 前端应用                        │
│  │  ┌──────────────────────────────────────────┐  │
│  │  │  [打开掘金] 按钮                          │  │
│  │  │  实时日志展示区域                         │  │
│  │  │  测试结果展示区域                         │  │
│  │  └──────────────────────────────────────────┘  │
│  └────────────┬──────────────────────────────────┘
│               │ Socket.IO 连接 (WebSocket)
│               ▼
├─────────────────────────────────────────────────────┤
│           后端服务器 (http://localhost:3001)         │
│  ┌─────────────────────────────────────────────────┐
│  │           Nest.js 应用                         │
│  │  ┌──────────────────────────────────────────┐  │
│  │  │  WebSocket 网关 (Socket.IO)             │  │
│  │  │  ├─ 接收: start-test 事件               │  │
│  │  │  └─ 发送: log, screenshot, success, error │  │
│  │  └──────────────────────────────────────────┘  │
│  │  ┌──────────────────────────────────────────┐  │
│  │  │  Playwright 测试服务                     │  │
│  │  │  ├─ 启动浏览器                          │  │
│  │  │  ├─ 导航到掘金                          │  │
│  │  │  ├─ 验证页面标题                        │  │
│  │  │  ├─ 保存截图                           │  │
│  │  │  └─ 关闭浏览器                          │  │
│  │  └──────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────┘
```

## 前置准备

### 系统要求
- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **操作系统**: Windows / macOS / Linux

### 安装 Node.js

访问 [nodejs.org](https://nodejs.org) 下载并安装最新的 LTS 版本。

### 验证安装
```bash
node --version
npm --version
```

## 安装和启动

### 1. 安装依赖

```bash
npm install
```

这个命令会自动为所有工作空间（前端和后端）安装依赖。

### 2. 启动应用

#### 方式一：并行启动（推荐）

```bash
npm run dev
```

这会同时启动前端和后端：
- 前端: http://localhost:3000
- 后端: http://localhost:3001

#### 方式二：分别启动

**启动后端：**
```bash
npm --workspace=@ez-publisher/backend run dev
```
后端会在 http://localhost:3001 启动，请等待看到 "Backend server is running" 的消息。

**启动前端（新开一个终端）：**
```bash
npm --workspace=@ez-publisher/frontend run dev
```
前端会在 http://localhost:3000 启动，自动打开浏览器。

### 3. 打开应用

访问 http://localhost:3000，您应该看到：

```
┌─────────────────────────────────────┐
│  掘金文章发布测试助手                │
│                                    │
│      [打开掘金]                      │
│                                    │
└─────────────────────────────────────┘
```

## 使用示例

### 执行测试

1. **打开前端页面**: 访问 http://localhost:3000

2. **点击按钮**: 点击"打开掘金"按钮

3. **观察过程**:
   ```
   [16:30:45] 正在连接后端服务...
   [16:30:45] 已连接到后端服务
   [16:30:46] 正在启动浏览器...
   [16:30:46] 浏览器已启动
   [16:30:47] 正在导航到掘金...
   [16:30:52] 页面加载完成
   [16:30:52] 页面标题: 稀土掘金 - 掘金是一个面向全球中文开发者的技术内容分享平台
   [16:30:52] ✓ 标题验证成功
   [16:30:53] 截图已保存: ./screenshots/juejin-1705330253000.png
   [16:30:54] ✓ 掘金页面加载和标题验证成功！
   [16:30:54] 浏览器已关闭
   ```

4. **查看结果**:
   - ✓ **测试通过** - 绿色背景
   - ✗ **测试失败** - 红色背景

### 截图位置

测试生成的截图保存在：
```
apps/backend/screenshots/juejin-{timestamp}.png
```

## 文件结构说明

### 前端应用 (`apps/frontend/`)

```
apps/frontend/
├── app.vue              # 主应用组件（包含所有UI和逻辑）
├── nuxt.config.ts      # Nuxt 配置
└── package.json        # 依赖管理
```

**主要功能:**
- 连接到后端 WebSocket
- 显示"打开掘金"按钮
- 实时显示浏览器操作日志
- 展示测试结果

### 后端应用 (`apps/backend/`)

```
apps/backend/
├── src/
│   ├── main.ts         # 应用入口，配置 CORS 和 WebSocket
│   ├── app.module.ts   # Nest.js 主模块
│   ├── test/
│   │   ├── test.service.ts   # Playwright 测试逻辑
│   │   └── test.gateway.ts   # WebSocket 网关
│   └── package.json
├── screenshots/        # 保存测试截图
└── tsconfig.json      # TypeScript 配置
```

**主要功能:**
- 启动 Nest.js 服务器
- 处理 WebSocket 连接
- 执行 Playwright 浏览器自动化
- 实时推送日志和结果

## Turborepo 工作流

### 可用命令

```bash
# 开发模式 - 启动所有应用
npm run dev

# 构建 - 编译所有应用
npm run build

# 测试 - 运行所有测试
npm run test

# 代码检查
npm run lint
```

### 工作空间命令

```bash
# 在特定工作空间运行命令
npm --workspace=@ez-publisher/frontend run build
npm --workspace=@ez-publisher/backend run build

# 只安装特定工作空间的依赖
npm install --workspace=@ez-publisher/backend
```

## 常见问题

### 问题 1: 后端启动失败

**错误消息:** `Cannot find module '@nestjs/core'`

**解决方案:**
```bash
npm install
npm --workspace=@ez-publisher/backend install
```

### 问题 2: 前端无法连接到后端

**错误消息:** `连接错误，请检查后端服务是否运行`

**检查清单:**
1. 确保后端已启动: `npm --workspace=@ez-publisher/backend run dev`
2. 检查后端是否在 http://localhost:3001 运行
3. 检查防火墙是否阻止连接
4. 检查 `.env` 文件中的 `NUXT_PUBLIC_API_URL`

### 问题 3: Playwright 浏览器无法启动

**错误消息:** `Failed to launch browser`

**解决方案:**
```bash
# 重新安装 Playwright 浏览器
npx playwright install chromium
```

### 问题 4: 端口被占用

**错误消息:** `EADDRINUSE: address already in use :::3000`

**解决方案:**
```bash
# 修改端口
# 前端: 编辑 .env 文件
# 后端: 编辑 apps/backend/src/main.ts，修改 listen() 的端口号
```

## 环境变量配置

复制 `.env.example` 为 `.env`:

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 前端配置
NUXT_PUBLIC_API_URL=http://localhost:3001

# 后端配置
NODE_ENV=development
PORT=3001
```

## 项目扩展

### 添加更多测试用例

编辑 `apps/backend/src/test/test.service.ts`:

```typescript
async runMultipleTests(onMessage: (message: TestMessage) => void): Promise<void> {
  // 测试1: 掘金
  await this.runJuejinTest(onMessage);

  // 测试2: CSDN
  await this.runCSDNTest(onMessage);
}
```

### 添加数据库支持

1. 安装数据库依赖
2. 在 `apps/backend/src/` 中添加数据库模块
3. 保存测试历史记录

### 添加用户认证

1. 集成 JWT 认证
2. 添加用户登录页面
3. 存储用户测试历史

## 构建生产版本

### 构建

```bash
npm run build
```

### 生产部署

**前端:**
```bash
cd apps/frontend
npm run generate
# 部署 .output/public 目录到静态服务器
```

**后端:**
```bash
cd apps/backend
npm run build
# 运行 dist/main.js
```

## 开发工具

### VS Code 推荐扩展

- Volar (Vue Language Features)
- NestJS Files
- Prettier - Code formatter
- ES7+ React/Redux/React-Native snippets

## 贡献指南

欢迎贡献代码！请：

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing`)
5. 提交 Pull Request

## 许可证

ISC

## 支持

如有问题或需要帮助，请提交 GitHub Issues。

---

**祝您使用愉快！** 🎉
