#!/bin/bash

# 项目测试流程验证脚本

echo "================================================"
echo "        EZ Article Publisher 项目测试"
echo "================================================"
echo ""

# 检查后端健康状态
echo "1. 检查后端服务..."
if curl -s http://localhost:3001 > /dev/null 2>&1; then
  echo "   ✓ 后端服务运行正常 (http://localhost:3001)"
else
  echo "   ✗ 后端服务无法连接"
  exit 1
fi

echo ""
echo "2. 检查前端服务..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "   ✓ 前端服务运行正常 (http://localhost:3000)"
else
  echo "   ✗ 前端服务无法连接"
  exit 1
fi

echo ""
echo "3. 项目架构:"
echo "   ├── 前端 (Nuxt 3): http://localhost:3000"
echo "   ├── 后端 (Nest.js): http://localhost:3001"
echo "   └── WebSocket: ws://localhost:3001/socket.io"

echo ""
echo "4. 接下来的步骤:"
echo "   • 打开浏览器访问: http://localhost:3000"
echo "   • 点击按钮: '打开掘金'"
echo "   • 观察浏览器自动化执行过程"
echo "   • 查看实时日志输出"
echo ""

echo "================================================"
echo "         ✓ 项目运行成功，可以开始测试!"
echo "================================================"
