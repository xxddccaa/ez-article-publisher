import { Injectable } from '@nestjs/common';
import { chromium, Page, Browser } from '@playwright/test';

export interface TestMessage {
  type: 'log' | 'screenshot' | 'success' | 'error';
  message?: string;
  level?: 'info' | 'success' | 'error' | 'warning';
  path?: string;
}

@Injectable()
export class TestService {
  private browser: Browser | null = null;

  async runJuejinTest(
    onMessage: (message: TestMessage) => void,
  ): Promise<void> {
    try {
      this.emit(onMessage, {
        type: 'log',
        message: '启动无头浏览器...',
        level: 'info',
      });

      // 启动浏览器
      this.browser = await chromium.launch({
        headless: false, // 显示浏览器窗口
      });

      this.emit(onMessage, {
        type: 'log',
        message: '浏览器已启动',
        level: 'success',
      });

      // 创建页面上下文
      const context = await this.browser.newContext();
      const page = await context.newPage();

      // 添加页面事件监听
      page.on('console', (msg) => {
        this.emit(onMessage, {
          type: 'log',
          message: `[浏览器日志] ${msg.type()}: ${msg.text()}`,
          level: 'info',
        });
      });

      // 导航到掘金
      this.emit(onMessage, {
        type: 'log',
        message: '正在导航到掘金...',
        level: 'info',
      });

      await page.goto('https://juejin.cn/', {
        waitUntil: 'networkidle',
      });

      this.emit(onMessage, {
        type: 'log',
        message: '页面加载完成',
        level: 'success',
      });

      // 获取页面标题
      const title = await page.title();
      this.emit(onMessage, {
        type: 'log',
        message: `页面标题: ${title}`,
        level: 'info',
      });

      // 检查标题是否包含预期的文本
      const hasExpectedTitle = /稀土掘金/.test(title);

      if (hasExpectedTitle) {
        this.emit(onMessage, {
          type: 'log',
          message: '✓ 标题验证成功',
          level: 'success',
        });
      } else {
        throw new Error(`标题不匹配，期望包含"稀土掘金"，实际: ${title}`);
      }

      // 截图
      const screenshotPath = `./screenshots/juejin-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });

      this.emit(onMessage, {
        type: 'screenshot',
        message: '页面截图',
        path: screenshotPath,
      });

      // 测试成功
      this.emit(onMessage, {
        type: 'success',
        message: '✓ 掘金页面加载和标题验证成功！',
      });

      // 清理资源
      await context.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit(onMessage, {
        type: 'log',
        message: `错误: ${errorMessage}`,
        level: 'error',
      });

      this.emit(onMessage, {
        type: 'error',
        message: `测试失败: ${errorMessage}`,
      });
    } finally {
      // 关闭浏览器
      if (this.browser) {
        await this.browser.close();
        this.emit(onMessage, {
          type: 'log',
          message: '浏览器已关闭',
          level: 'info',
        });
      }
    }
  }

  private emit(
    onMessage: (message: TestMessage) => void,
    message: TestMessage,
  ): void {
    onMessage(message);
  }
}
