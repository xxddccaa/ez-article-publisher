# EZ Article Publisher

使用 Playwright 实现文章发布助手，发布到掘金、CSDN 等。

## 项目架构

这是一个 Turborepo Monorepo 架构，包含：

- **frontend**: Nuxt 3 前端应用
- **backend**: Nest.js 后端 API 服务
- **packages**: 共享库（未来扩展）

## 功能特性

- 🚀 Nuxt 3 现代前端框架
- 🔧 Nest.js 强大的后端框架
- 🎭 Playwright 自动化浏览器测试
- 🔌 WebSocket 实时通信
- 📦 Turborepo 高效 Monorepo 管理

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 开发环境运行

同时启动前端和后端：

```bash
npm run dev
```

或分别启动：

```bash
# 启动后端 (端口 3001)
npm --workspace=@ez-publisher/backend run dev

# 在另一个终端启动前端 (端口 3000)
npm --workspace=@ez-publisher/frontend run dev
```

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
.
├── apps/
│   ├── frontend/              # Nuxt 3 前端应用
│   │   ├── app.vue           # 主应用入口
│   │   ├── nuxt.config.ts    # Nuxt 配置
│   │   └── package.json
│   └── backend/               # Nest.js 后端应用
│       ├── src/
│       │   ├── main.ts       # 应用入口
│       │   ├── app.module.ts # 主模块
│       │   └── test/
│       │       ├── test.service.ts    # Playwright 测试服务
│       │       └── test.gateway.ts    # WebSocket 网关
│       ├── screenshots/      # 测试截图保存目录
│       ├── tsconfig.json
│       └── package.json
├── packages/                  # 共享库（未来扩展）
├── turbo.json                # Turborepo 配置
├── package.json              # 根目录配置
└── .env.example              # 环境变量示例
```

## 工作流程

1. **用户界面**: 访问 http://localhost:3000
2. **点击按钮**: 用户点击"打开掘金"按钮
3. **建立连接**: 前端通过 Socket.IO 连接后端
4. **执行测试**: 后端使用 Playwright 启动浏览器
5. **实时反馈**: 通过 WebSocket 实时发送日志和截图
6. **显示结果**: 前端展示测试结果

## Playwright 测试流程

当前测试用例 (`test/example.spec.ts`):

```javascript
test('add', async ({ page }) => {
  await page.goto('https://juejin.cn/');
  await expect(page).toHaveTitle(/稀土掘金/);
});
```

对应的自动化流程：

1. 启动无头浏览器（非无头模式，可见）
2. 导航到掘金官网
3. 验证页面标题
4. 保存页面截图
5. 关闭浏览器

## 实时通信协议

### 消息类型

**客户端发送:**
```json
{ "action": "start-test" }
```

**服务器响应:**
```json
// 日志消息
{ "type": "log", "message": "...", "level": "info|success|error|warning" }

// 截图消息
{ "type": "screenshot", "message": "...", "path": "/path/to/screenshot.png" }

// 成功消息
{ "type": "success", "message": "测试通过" }

// 错误消息
{ "type": "error", "message": "错误详情" }
```

## 配置

### 环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

默认配置：
- 前端: http://localhost:3000
- 后端: http://localhost:3001
- WebSocket: ws://localhost:3001

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式运行所有应用
npm run dev

# 构建所有应用
npm run build

# 运行测试
npm run test

# 代码检查
npm run lint
```

## 后续优化

- [ ] 支持多个测试用例
- [ ] 测试结果持久化存储
- [ ] 用户认证系统
- [ ] 测试历史记录
- [ ] 性能优化指标
- [ ] Docker 容器化部署
- [ ] 国际化支持

## 许可证

ISC

## 贡献

欢迎提交 Issues 和 Pull Requests！
