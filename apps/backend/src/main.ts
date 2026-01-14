import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 配置WebSocket
  const server = await app.listen(3001);
  console.log(`Backend server is running on http://localhost:3001`);
  console.log(`WebSocket available at ws://localhost:3001/socket.io`);
}

bootstrap();
