#!/usr/bin/env node

const io = require('socket.io-client');
const socket = io('http://localhost:3001', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

let testPassed = false;
let logCount = 0;

socket.on('connect', () => {
  console.log('[Client] ✓ 已连接到后端服务');
  console.log('[Client] 发送 start-test 事件...\n');
  socket.emit('start-test', {});
});

socket.on('message', (data) => {
  logCount++;

  switch (data.type) {
    case 'log':
      const timestamp = new Date().toLocaleTimeString('zh-CN');
      console.log(`[${timestamp}] ${data.message}`);
      break;

    case 'screenshot':
      console.log(`[截图] ${data.path}`);
      break;

    case 'success':
      console.log(`\n✓ ${data.message}`);
      testPassed = true;
      break;

    case 'error':
      console.log(`\n✗ ${data.message}`);
      testPassed = false;
      break;
  }
});

socket.on('error', (error) => {
  console.error('[错误] WebSocket 连接错误:', error);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('\n[Client] 已断开连接');
  console.log(`[统计] 共接收 ${logCount} 条日志消息`);
  console.log(`[结果] ${testPassed ? '✓ 测试通过' : '✗ 测试失败'}`);
  process.exit(testPassed ? 0 : 1);
});

// 30 秒超时
setTimeout(() => {
  console.error('[超时] 测试执行超过 30 秒');
  socket.disconnect();
  process.exit(1);
}, 30000);
