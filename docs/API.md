# API 文档

本文档描述当前 Docker 化 CSDN 发布服务暴露的 HTTP 接口。

基础地址：

```text
http://localhost:3001
```

默认返回 JSON。

## 1. 健康检查

`GET /health`

用于确认 API 进程是否存活。

请求示例：

```bash
curl http://localhost:3001/health
```

成功响应：

```json
{
  "ok": true
}
```

## 2. 查看浏览器会话状态

`GET /api/csdn/session`

用于查看浏览器是否已打开、当前是否已登录、当前页面地址，以及最近一次错误。

请求示例：

```bash
curl http://localhost:3001/api/csdn/session
```

成功响应：

```json
{
  "browserOpen": true,
  "loggedIn": true,
  "currentUrl": "https://editor.csdn.net/md/?not_checkout=1&spm=1015.2103.3001.8066",
  "lastError": null
}
```

字段说明：

- `browserOpen`: 浏览器会话是否存在
- `loggedIn`: 当前是否已登录 CSDN
- `currentUrl`: 浏览器当前页面
- `lastError`: 最近一次运行错误，成功后通常为 `null`

## 3. 打开浏览器会话

`POST /api/csdn/session/open`

如果当前没有浏览器会话，这个接口会启动 Chromium 并打开 CSDN Markdown 编辑器。

请求示例：

```bash
curl -X POST http://localhost:3001/api/csdn/session/open
```

成功响应：

```json
{
  "browserOpen": true,
  "loggedIn": false,
  "currentUrl": "https://editor.csdn.net/md/?not_checkout=1&spm=1015.2103.3001.8066",
  "lastError": null
}
```

## 4. 关闭浏览器会话

`POST /api/csdn/session/close`

关闭当前浏览器上下文。下次再次发布前，可以调用 `session/open` 重新打开。

请求示例：

```bash
curl -X POST http://localhost:3001/api/csdn/session/close
```

成功响应：

```json
{
  "browserOpen": false,
  "loggedIn": false,
  "currentUrl": null,
  "lastError": null
}
```

## 5. 发布文章

`POST /api/csdn/publish`

这是核心接口。接口接收 Markdown 内容，并通过浏览器自动化发布到 CSDN Markdown 编辑器。

### 请求体

```json
{
  "title": "树莓派上部署 Python 服务并配置 systemd 开机自启",
  "markdown": "# 树莓派部署记录\n\n这里是 Markdown 正文。",
  "tags": ["树莓派", "Python", "systemd"],
  "category": "树莓派",
  "summary": "记录一次在树莓派上部署 Python 服务并配置开机自启的完整流程。",
  "visibility": "公开",
  "closeBrowserAfterPublish": false
}
```

### 字段说明

- `title`: `string`，必填，文章标题
- `markdown`: `string`，必填，Markdown 正文
- `tags`: `string[]`，可选，文章标签
- `category`: `string`，可选，单个分类专栏名称
- `summary`: `string`，可选，文章摘要
- `visibility`: `string`，可选，可见性文案，例如 `公开`
- `closeBrowserAfterPublish`: `boolean`，可选，发布后是否关闭浏览器

### 分类专栏匹配规则

`category` 采用单专栏匹配，匹配优先级如下：

1. 精确匹配
2. 前缀匹配
3. 包含匹配

为了减少误选，泛匹配时会尽量避开包含 `仅我可见` 的专栏。

建议始终传完整专栏名，例如：

```json
{
  "category": "树莓派"
}
```

### 请求示例

```bash
curl -X POST http://localhost:3001/api/csdn/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "树莓派上部署 Python 服务并配置 systemd 开机自启",
    "markdown": "# 树莓派部署记录\\n\\n这里是 Markdown 正文。",
    "tags": ["树莓派", "Python", "systemd"],
    "category": "树莓派",
    "summary": "记录一次在树莓派上部署 Python 服务并配置开机自启的完整流程。"
  }'
```

### 成功响应

```json
{
  "ok": true,
  "articleUrl": "https://blog.csdn.net/xxx/article/details/123456789",
  "screenshotPath": "/data/screenshots/publish-success-1777449159389.png",
  "message": "Article published successfully"
}
```

字段说明：

- `ok`: 是否成功
- `articleUrl`: 已发布文章地址；如果未拿到最终地址，可能为 `null`
- `screenshotPath`: 容器内截图路径；宿主机默认对应 `data/screenshots/`
- `message`: 执行结果说明

### 失败响应

失败时接口返回 HTTP 500，响应体类似：

```json
{
  "statusCode": 500,
  "message": {
    "ok": false,
    "articleUrl": null,
    "screenshotPath": "/data/screenshots/publish-failed-1777448526564.png",
    "message": "Unable to find category trigger"
  }
}
```

排障建议：

- 查看 `message.message`
- 查看 `GET /api/csdn/session` 的 `lastError`
- 打开宿主机 `data/screenshots/` 中对应截图

## 常见调用顺序

首次启动：

1. `POST /api/csdn/session/open`
2. 在 noVNC 中登录 CSDN
3. `GET /api/csdn/session` 确认 `loggedIn=true`
4. `POST /api/csdn/publish`

日常调用：

1. `GET /api/csdn/session`
2. 如未打开则 `POST /api/csdn/session/open`
3. `POST /api/csdn/publish`

## 备注

- 当前固定走 CSDN Markdown 编辑器，不走富文本编辑器
- 当前接口重点服务单账号、单机、本地自动化场景
- 并发发布由服务内部串行化处理，避免多个请求同时争用同一浏览器会话
