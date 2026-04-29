# EZ Article Publisher

把 CSDN Markdown 发文流程封装成一个本地 HTTP 服务。

这个项目当前的落地方向是：

- 用 Docker 启动 Playwright + Chromium + noVNC
- 你自己手动登录 CSDN，一次登录后持久保存会话
- 后续通过 REST 接口传入标题、Markdown、标签、专栏、摘要
- 服务自动打开 CSDN Markdown 编辑器并完成发布

注意：这不是 CSDN 官方开放 API，而是基于网页自动化的本地服务。只要 CSDN 页面结构改版，选择器就可能需要调整。

## 当前能力

- 固定使用 CSDN Markdown 编辑器页面
- 支持持久化登录态
- 支持 Docker 一键启动
- 支持 noVNC 远程查看容器里的浏览器
- 支持 REST 接口触发发布
- 支持标签、单个分类专栏、摘要、可见性
- 自动保存成功/失败截图，便于排障

## 整体架构

```text
.
├── apps/backend/src/csdn/    # CSDN 自动化服务 + REST 控制器
├── docker/start.sh           # Xvfb / x11vnc / noVNC / API 启动脚本
├── Dockerfile
├── docker-compose.yml
├── docs/API.md               # 接口文档
└── data/
    ├── profile/              # Chromium 持久化登录态
    └── screenshots/          # 发布成功/失败截图
```

## 运行要求

- Docker / Docker Compose
- 本机可访问 CSDN
- 需要你自己完成一次 CSDN 登录

## 快速开始

在项目根目录执行：

```bash
docker compose up --build -d
```

启动完成后会暴露两个入口：

- API: `http://localhost:3001`
- noVNC: `http://localhost:6080/vnc.html?autoconnect=1&resize=remote`

可以先确认服务健康状态：

```bash
curl http://localhost:3001/health
```

期望返回：

```json
{"ok":true}
```

## 第一次登录 CSDN

1. 启动容器
2. 打开 `http://localhost:6080/vnc.html?autoconnect=1&resize=remote`
3. 容器里的 Chromium 会自动打开 CSDN Markdown 编辑器
4. 你在 noVNC 页面里完成登录
5. 登录状态会保存在 `data/profile/`

登录成功后，可以检查会话状态：

```bash
curl http://localhost:3001/api/csdn/session
```

典型返回：

```json
{
  "browserOpen": true,
  "loggedIn": true,
  "currentUrl": "https://editor.csdn.net/md/?not_checkout=1&spm=1015.2103.3001.8066",
  "lastError": null
}
```

## 发布文章

核心接口：

```bash
curl -X POST http://localhost:3001/api/csdn/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "树莓派上部署 Python 服务并配置 systemd 开机自启",
    "markdown": "# 树莓派部署记录\n\n这里是 Markdown 正文。",
    "tags": ["树莓派", "Python", "systemd"],
    "category": "树莓派",
    "summary": "记录一次在树莓派上部署 Python 服务并配置开机自启的流程。",
    "visibility": "公开"
  }'
```

字段说明：

- `title`: 必填，文章标题
- `markdown`: 必填，Markdown 正文
- `tags`: 可选，字符串数组；建议传
- `category`: 可选，单个分类专栏名称
- `summary`: 可选，文章摘要
- `visibility`: 可选，可传界面上可见范围的文本，例如 `公开`
- `closeBrowserAfterPublish`: 可选，发布后关闭浏览器会话

成功返回示例：

```json
{
  "ok": true,
  "articleUrl": "https://blog.csdn.net/xxx/article/details/123456789",
  "screenshotPath": "/data/screenshots/publish-success-1777449159389.png",
  "message": "Article published successfully"
}
```

失败时服务会返回 500，同时带上失败截图路径，便于直接去 `data/screenshots/` 排查。

## 专栏控制说明

当前接口的 `category` 字段按“单个专栏”设计，符合常见使用方式。

- 传 `category: "树莓派"` 时，会优先精确匹配
- 如果没有精确匹配，再尝试前缀匹配和包含匹配
- 会尽量避开名字里含 `仅我可见` 的专栏
- 现在已经实测能正确选择 `树莓派`

如果你的专栏名比较相近，建议直接传完整专栏名，避免误匹配。

## 会话管理接口

重新打开浏览器会话：

```bash
curl -X POST http://localhost:3001/api/csdn/session/open
```

关闭浏览器会话：

```bash
curl -X POST http://localhost:3001/api/csdn/session/close
```

查看当前会话：

```bash
curl http://localhost:3001/api/csdn/session
```

完整接口说明见 `docs/API.md`

## Docker 相关说明

默认挂载：

- `./data/profile:/data/profile`
- `./data/screenshots:/data/screenshots`

这意味着：

- 浏览器登录信息会保存在宿主机
- 容器重启后仍然保留登录态
- 每次发布成功或失败都会在宿主机留下截图

容器启动脚本会自动做几件事：

- 启动 `Xvfb`
- 启动 `fluxbox`
- 启动 `x11vnc`
- 启动 `noVNC`
- 清理 Chromium 锁文件
- 启动 Nest API

## 本地开发

安装依赖：

```bash
npm install
```

启动后端开发服务：

```bash
PORT=3001 AUTO_OPEN_BROWSER=true npm --workspace=@ez-publisher/backend run dev
```

如果你不想自动打开浏览器：

```bash
PORT=3001 AUTO_OPEN_BROWSER=false npm --workspace=@ez-publisher/backend run dev
```

## 常见问题

### 1. 打开 noVNC 后浏览器没起来

先检查 API：

```bash
curl http://localhost:3001/api/csdn/session
```

如果 `browserOpen` 是 `false`，执行：

```bash
curl -X POST http://localhost:3001/api/csdn/session/open
```

### 2. 登录后下次还要重新登录吗

正常情况下不用。登录态会保存在 `data/profile/`。

### 3. 为什么发布失败

常见原因：

- CSDN 页面结构变了
- 当前账号未完成登录
- 标签或专栏弹层没有按预期加载
- 网络抖动导致页面没完全就绪

优先去看：

- `GET /api/csdn/session` 返回的 `lastError`
- `data/screenshots/` 里的失败截图

### 4. Markdown 内容会不会被当成富文本粘贴

不会。当前流程直接走 CSDN 的 Markdown 编辑器页面。

## 停止服务

```bash
docker compose down
```

如果想连同登录态和截图一起清掉：

```bash
rm -rf data/profile data/screenshots
```

## 已知限制

- 当前方案是网页自动化，不是官方 API
- CSDN 改版后可能需要更新选择器
- 当前重点覆盖 CSDN Markdown 发文主流程
- 分类专栏目前按“单个专栏”控制，不做多选接口

## 接口文档

- `docs/API.md`
