import { Module } from '@nestjs/common';
import { TestGateway } from './test/test.gateway';
import { TestService } from './test/test.service';

@Module({
  providers: [TestGateway, TestService],
})
export class AppModule {}
