<template>
  <div class="container">
    <div class="header">
      <h1>掘金文章发布测试助手</h1>
    </div>

    <div class="button-section">
      <button class="btn btn-primary" @click="openJuejin">
        打开掘金
      </button>
    </div>

    <div v-if="showBrowser" class="browser-section">
      <div class="browser-header">
        <h2>浏览器运行中...</h2>
        <button class="btn btn-small" @click="closeBrowser">关闭</button>
      </div>

      <div class="log-container">
        <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">
          <span class="timestamp">{{ log.time }}</span>
          <span class="message">{{ log.message }}</span>
        </div>
      </div>

      <div v-if="testResult" class="result-section" :class="testResult.success ? 'success' : 'error'">
        <h3>{{ testResult.success ? '✓ 测试通过' : '✗ 测试失败' }}</h3>
        <p>{{ testResult.message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Log {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

interface TestResult {
  success: boolean
  message: string
}

const showBrowser = ref(false)
const logs = ref<Log[]>([])
const testResult = ref<TestResult | null>(null)
const ws = ref<WebSocket | null>(null)

const config = useRuntimeConfig()

const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
  const time = new Date().toLocaleTimeString('zh-CN')
  logs.value.push({ time, message, type })
  // 自动滚动到底部
  nextTick(() => {
    const container = document.querySelector('.log-container')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

const openJuejin = async () => {
  showBrowser.value = true
  logs.value = []
  testResult.value = null

  addLog('正在连接后端服务...', 'info')

  try {
    // 导入Socket.IO客户端库
    const io = await import('socket.io-client').then(m => m.io)

    // 连接到后端
    const socket = io(config.public.apiUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    })

    socket.on('connect', () => {
      addLog('已连接到后端服务', 'success')
      addLog('正在启动浏览器...', 'info')
      // 发送开始测试命令
      socket.emit('start-test', {})
    })

    socket.on('message', (data) => {
      switch (data.type) {
        case 'log':
          addLog(data.message, data.level || 'info')
          break
        case 'screenshot':
          addLog(`截图已保存: ${data.path}`, 'success')
          break
        case 'success':
          testResult.value = {
            success: true,
            message: data.message
          }
          addLog(data.message, 'success')
          break
        case 'error':
          testResult.value = {
            success: false,
            message: data.message
          }
          addLog(data.message, 'error')
          break
      }
    })

    socket.on('error', (error) => {
      addLog(`连接错误: ${error}`, 'error')
      testResult.value = {
        success: false,
        message: '连接错误，请检查后端服务是否运行'
      }
    })

    socket.on('disconnect', () => {
      addLog('已断开连接', 'warning')
    })

    ws.value = socket as any
  } catch (error) {
    addLog(`错误: ${error}`, 'error')
  }
}

const closeBrowser = () => {
  if (ws.value) {
    ws.value.close()
  }
  showBrowser.value = false
}

onUnmounted(() => {
  if (ws.value) {
    ws.value.close()
  }
})
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 32px;
  color: #333;
  margin: 0;
}

.button-section {
  text-align: center;
  margin-bottom: 40px;
}

.btn {
  padding: 12px 24px;
  font-size: 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background-color: #5e72e4;
  color: white;
}

.btn-primary:hover {
  background-color: #4c63d2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(94, 114, 228, 0.4);
}

.btn-small {
  padding: 6px 12px;
  font-size: 14px;
  background-color: #6c757d;
  color: white;
}

.btn-small:hover {
  background-color: #5a6268;
}

.browser-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #dee2e6;
}

.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #dee2e6;
}

.browser-header h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.log-container {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 15px;
  border-radius: 4px;
  height: 400px;
  overflow-y: auto;
  margin-bottom: 20px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.log-item {
  margin-bottom: 8px;
  display: flex;
  gap: 10px;
}

.timestamp {
  color: #858585;
  flex-shrink: 0;
}

.message {
  flex: 1;
  word-break: break-word;
}

.log-item.success {
  color: #4ec9b0;
}

.log-item.error {
  color: #f48771;
}

.log-item.warning {
  color: #dcdcaa;
}

.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: #2d2d30;
}

.log-container::-webkit-scrollbar-thumb {
  background: #464646;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #5a5a5a;
}

.result-section {
  padding: 20px;
  border-radius: 4px;
  text-align: center;
}

.result-section.success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.result-section.error {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.result-section h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.result-section p {
  margin: 0;
}
</style>
