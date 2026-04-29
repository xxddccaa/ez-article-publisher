import { Module } from '@nestjs/common';
import { CsdnController } from './csdn/csdn.controller';
import { CsdnService } from './csdn/csdn.service';

@Module({
  controllers: [CsdnController],
  providers: [CsdnService],
})
export class AppModule {}
