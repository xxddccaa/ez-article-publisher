import { Body, Controller, Get, Post } from '@nestjs/common';
import { CsdnService } from './csdn.service';
import {
  PublishArticleRequest,
  PublishArticleResponse,
  SessionStatus,
} from './csdn.types';

@Controller()
export class CsdnController {
  constructor(private readonly csdnService: CsdnService) {}

  @Get('health')
  async health(): Promise<{ ok: true }> {
    return { ok: true };
  }

  @Get('api/csdn/session')
  async getSessionStatus(): Promise<SessionStatus> {
    return this.csdnService.getSessionStatus();
  }

  @Post('api/csdn/session/open')
  async openSession(): Promise<SessionStatus> {
    await this.csdnService.openSession();
    return this.csdnService.getSessionStatus();
  }

  @Post('api/csdn/session/close')
  async closeSession(): Promise<SessionStatus> {
    await this.csdnService.closeSession();
    return this.csdnService.getSessionStatus();
  }

  @Post('api/csdn/publish')
  async publishArticle(
    @Body() body: PublishArticleRequest,
  ): Promise<PublishArticleResponse> {
    return this.csdnService.publishArticle(body);
  }
}
