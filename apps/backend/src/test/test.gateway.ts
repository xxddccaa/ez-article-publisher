import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TestService } from './test.service';
import { Inject } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TestGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private testService: TestService) {}

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
    client.emit('connected', { message: '已连接到服务器' });
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('start-test')
  async handleStartTest(client: Socket, data: any) {
    console.log(`Starting test for client: ${client.id}`);

    // 定义消息发送函数
    const sendMessage = (message: any) => {
      client.emit('message', message);
    };

    // 运行测试
    await this.testService.runJuejinTest(sendMessage);
  }
}
