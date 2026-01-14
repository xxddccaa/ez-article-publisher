# 技术架构文档

## 技术栈概览

### 前端 (Nuxt 3)
- **框架**: Vue 3 + Nuxt 3
- **通信**: Socket.IO Client (WebSocket)
- **样式**: Vue Scoped CSS
- **端口**: 3000

### 后端 (Nest.js)
- **框架**: Nest.js 10.3.0
- **实时通信**: Socket.IO (WebSocket)
- **自动化测试**: Playwright
- **语言**: TypeScript
- **端口**: 3001

### 项目管理
- **Monorepo**: Turborepo
- **包管理**: npm Workspaces
- **版本控制**: Git

## 数据流和通信

### 连接流程

```
用户点击 "打开掘金" 按钮
         ↓
前端初始化 Socket.IO 连接
         ↓
后端 WebSocket 网关接收连接请求
         ↓
发送 "start-test" 事件
         ↓
后端服务启动 Playwright 浏览器
         ↓
实时推送日志消息
         ↓
前端接收并显示
```

### 消息协议

#### 前端发送 → 后端

```typescript
// 开始测试
{
  action: 'start-test'
}
```

#### 后端发送 → 前端

```typescript
// 日志消息
{
  type: 'log',
  message: '正在启动浏览器...',
  level: 'info' | 'success' | 'error' | 'warning'
}

// 截图消息
{
  type: 'screenshot',
  message: '页面截图',
  path: './screenshots/juejin-1705330253000.png'
}

// 成功消息
{
  type: 'success',
  message: '✓ 掘金页面加载和标题验证成功！'
}

// 错误消息
{
  type: 'error',
  message: '测试失败: 标题不匹配'
}
```

## 核心模块说明

### 前端 (apps/frontend/app.vue)

#### 关键状态变量

```typescript
const showBrowser = ref(false)          // 是否显示浏览器运行界面
const logs = ref<Log[]>([])            // 日志列表
const testResult = ref<TestResult|null>(null)  // 测试结果
const ws = ref<WebSocket | null>(null)  // WebSocket 连接
```

#### 关键方法

```typescript
// 连接后端并执行测试
const openJuejin = async () => {
  // 1. 建立 Socket.IO 连接
  // 2. 发送 start-test 事件
  // 3. 监听 message 事件接收日志
}

// 添加日志
const addLog = (message: string, type: string) => {
  // 1. 获取当前时间
  // 2. 添加到日志数组
  // 3. 自动滚动到底部
}

// 关闭浏览器
const closeBrowser = () => {
  // 关闭 WebSocket 连接
  // 隐藏浏览器界面
}
```

### 后端 (apps/backend/)

#### test.gateway.ts - WebSocket 网关

```typescript
@WebSocketGateway()  // 配置 Socket.IO 服务器
class TestGateway {
  constructor(private testService: TestService) {}

  // 客户端连接时
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`)
    client.emit('connected', { message: '已连接到服务器' })
  }

  // 接收 start-test 事件
  @SubscribeMessage('start-test')
  async handleStartTest(client: Socket, data: any) {
    // 运行测试
    await this.testService.runJuejinTest((message) => {
      // 将消息实时推送给客户端
      client.emit('message', message)
    })
  }

  // 客户端断开连接时
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`)
  }
}
```

#### test.service.ts - Playwright 测试服务

```typescript
@Injectable()
class TestService {
  async runJuejinTest(onMessage: (msg: TestMessage) => void) {
    // 1. 启动无头浏览器
    const browser = await chromium.launch({
      headless: false  // 显示浏览器窗口
    })

    // 2. 创建页面上下文
    const context = await browser.newContext()
    const page = await context.newPage()

    // 3. 导航到掘金
    await page.goto('https://juejin.cn/', {
      waitUntil: 'networkidle'
    })

    // 4. 验证页面标题
    const title = await page.title()
    if (!/稀土掘金/.test(title)) {
      throw new Error('Title mismatch')
    }

    // 5. 保存截图
    await page.screenshot({
      path: `./screenshots/juejin-${Date.now()}.png`
    })

    // 6. 关闭浏览器
    await browser.close()

    // 7. 推送成功消息
    onMessage({
      type: 'success',
      message: '✓ 测试通过'
    })
  }
}
```

## Turborepo 工作流

### 项目结构

```
.
├── apps/                          # 应用目录
│   ├── frontend/
│   │   ├── app.vue
│   │   ├── nuxt.config.ts
│   │   └── package.json
│   └── backend/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   └── test/
│       ├── tsconfig.json
│       └── package.json
├── packages/                      # 共享库（未来扩展）
│   └── shared/
│       └── package.json
├── turbo.json                     # Turborepo 配置
├── package.json                   # 工作空间配置
└── tsconfig.json                  # 全局 TypeScript 配置
```

### turbo.json 配置说明

```json
{
  "pipeline": {
    "dev": {
      "cache": false,              // 开发模式不缓存
      "persistent": true           // 持续运行
    },
    "build": {
      "outputs": ["dist/**"],      // 输出目录
      "dependsOn": ["^build"]      // 依赖的任务
    },
    "test": {
      "cache": false               // 测试不缓存
    }
  }
}
```

## 性能优化

### 前端优化

1. **WebSocket 重连机制**
   ```typescript
   const socket = io(apiUrl, {
     reconnection: true,
     reconnectionDelay: 1000,
     reconnectionDelayMax: 5000,
     reconnectionAttempts: 5
   })
   ```

2. **虚拟滚动日志**
   - 自动滚动到最新日志
   - CSS 高度固定防止重排

3. **Vue 3 响应式系统**
   - 使用 `ref` 管理状态
   - 高效的更新机制

### 后端优化

1. **浏览器实例管理**
   - 及时关闭浏览器进程
   - 释放内存资源

2. **异步处理**
   - 非阻塞式消息发送
   - 高效的 Socket.IO 事件处理

3. **错误处理**
   - 完整的 try-catch 机制
   - 资源清理保证

## 安全考虑

1. **CORS 配置**
   ```typescript
   app.enableCors({
     origin: '*',  // 生产环境应配置具体域名
     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
     credentials: true
   })
   ```

2. **WebSocket 安全**
   - 建议添加认证令牌验证
   - 限制连接数

3. **环境变量**
   - 敏感配置使用 .env 文件
   - 不提交到版本控制

## 扩展指南

### 添加新的测试流程

1. **创建新的 service 方法**
   ```typescript
   async runCSDNTest(onMessage: (msg: TestMessage) => void) {
     // 实现 CSDN 测试
   }
   ```

2. **在 gateway 中添加新事件**
   ```typescript
   @SubscribeMessage('start-csdn-test')
   async handleStartCSDNTest(client: Socket) {
     await this.testService.runCSDNTest((msg) => {
       client.emit('message', msg)
     })
   }
   ```

3. **在前端添加新按钮**
   ```vue
   <button @click="openCSPN">打开 CSDN</button>
   ```

### 集成数据库

1. **安装 TypeORM**
   ```bash
   npm install typeorm mysql2
   ```

2. **创建实体和数据库模块**
   ```typescript
   @Entity()
   class TestResult {
     @PrimaryGeneratedColumn()
     id: number

     @Column()
     testName: string

     @Column()
     status: string

     @CreateDateColumn()
     createdAt: Date
   }
   ```

3. **保存测试结果**
   ```typescript
   await this.testResultRepository.save({
     testName: 'juejin',
     status: success ? 'passed' : 'failed'
   })
   ```

## 调试方法

### 前端调试

```typescript
// 在 app.vue 中添加调试日志
console.log('Socket event:', data)
console.log('Logs:', logs.value)
```

### 后端调试

```typescript
// 在 test.service.ts 中添加调试日志
console.log('Browser launched')
console.log('Page title:', await page.title())

// Nest.js 调试模式
npm run debug
```

### 网络调试

- **前端**: 打开浏览器开发者工具 → Network → WS 标签页查看 WebSocket 消息
- **后端**: 查看后端控制台输出的连接和消息日志

## 相关资源

- [Nuxt 3 文档](https://nuxt.com)
- [Nest.js 文档](https://docs.nestjs.com)
- [Playwright 文档](https://playwright.dev)
- [Socket.IO 文档](https://socket.io/docs)
- [Turborepo 文档](https://turbo.build)
- [TypeScript 文档](https://www.typescriptlang.org)

## 常见问题解决

### Q: 如何修改测试的浏览器类型？
A: 在 `test.service.ts` 中修改：
```typescript
// 使用 Firefox 浏览器
const browser = await firefox.launch({ headless: false })
```

### Q: 如何添加多个测试用例？
A: 在 gateway 中添加多个 @SubscribeMessage 方法，或者在 service 中创建包含多个测试的方法。

### Q: 生产环境如何部署？
A:
1. 执行 `npm run build` 构建所有应用
2. 部署前端的 `.output` 目录
3. 启动后端 Node.js 应用
4. 配置反向代理（如 Nginx）

---

更多详细信息请查看 [QUICK_START.md](./QUICK_START.md)
