import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  BrowserContext,
  Frame,
  Locator,
  Page,
  chromium,
} from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PublishArticleRequest,
  PublishArticleResponse,
  SessionStatus,
} from './csdn.types';

const CSDN_EDITOR_URL =
  'https://editor.csdn.net/md/?not_checkout=1&spm=1015.2103.3001.8066';
const DEFAULT_VIEWPORT = { width: 1440, height: 960 };
const TITLE_SELECTORS = [
  'input[placeholder*="请输入文章标题"]',
  'div.article-bar input[placeholder*="文章标题"]',
  'div.article-bar textarea[placeholder*="文章标题"]',
  '.input__title textarea',
  'input[placeholder*="文章标题"]',
  'textarea[placeholder*="文章标题"]',
  'input[placeholder*="标题"]',
  'textarea[placeholder*="标题"]',
];
const CONTENT_SELECTORS = [
  '.editor__inner',
  '.editor .cledit-section',
  '.editor .cledit-section:last-child',
  'textarea[placeholder*="请输入正文"]',
  'div[contenteditable="true"][data-placeholder]',
  'div[contenteditable="true"] p',
  '.editor [contenteditable="true"]',
  '.bytemd-editor textarea',
  '.cm-content',
  '.CodeMirror textarea',
  '.monaco-editor textarea',
  '[contenteditable="true"]',
];
const TAG_TRIGGER_SELECTORS = [
  'button:has-text("添加文章标签")',
  '.mark_selection button:has-text("添加文章标签")',
  '.tag__btn-tag',
];
const TAG_INPUT_SELECTORS = [
  '.mark_selection_box input[placeholder*="请输入文字搜索"]',
  '.mark_selection_box input',
  'input[placeholder*="请输入文字搜索"]',
];
const TAG_MODAL_CLOSE_SELECTORS = ['.mark_selection_box .modal__close-button'];
const CATEGORY_TRIGGER_SELECTORS = [
  'button:has-text("新建分类专栏")',
  '.tag__btn-tag:has-text("新建分类专栏")',
];
const CATEGORY_OPTION_SELECTORS = ['input.tag__option-chk'];
const CATEGORY_MODAL_CLOSE_SELECTORS = ['.tag__options-content .modal__close-button'];
const SUMMARY_SELECTORS = [
  '.desc-box textarea',
  '.desc-box textarea[placeholder*="摘要"]',
  'textarea[placeholder*="本内容会在各展现列表中展示"]',
  'textarea[placeholder*="摘要"]',
];
const FINAL_PUBLISH_SELECTORS = [
  'button:has-text("发布博客")',
  '.modal__button-bar button:has-text("发布文章")',
  '[role="dialog"] button:has-text("发布文章")',
  'button:has-text("发布文章")',
];
const MARKDOWN_MODE_SELECTORS = [
  'button:has-text("使用 MD 编辑器")',
  'button:has-text("MD编辑器")',
];
const MODE_CONFIRM_SELECTORS = [
  'button:has-text("继续切换")',
  'button:has-text("确认切换")',
  'button:has-text("确定")',
];

@Injectable()
export class CsdnService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CsdnService.name);
  private readonly port = Number(process.env.PORT || 3001);
  private readonly browserStateDir =
    process.env.BROWSER_STATE_DIR || '/data/profile';
  private readonly screenshotsDir =
    process.env.SCREENSHOTS_DIR || path.resolve(process.cwd(), 'screenshots');
  private readonly autoOpenBrowser =
    process.env.AUTO_OPEN_BROWSER !== 'false';
  private readonly display = process.env.DISPLAY;

  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private lastError: string | null = null;
  private publishChain = Promise.resolve();
  private browserLaunchPromise: Promise<void> | null = null;

  async onModuleInit(): Promise<void> {
    fs.mkdirSync(this.browserStateDir, { recursive: true });
    fs.mkdirSync(this.screenshotsDir, { recursive: true });

    if (this.autoOpenBrowser) {
      this.logger.log('Opening persistent browser session on startup');
      try {
        await this.openSession();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.lastError = message;
        this.logger.error(`Failed to open browser session: ${message}`);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeSession();
  }

  async getSessionStatus(): Promise<SessionStatus> {
    const page = this.page;
    const browserOpen = Boolean(this.context && page && !page.isClosed());

    if (!browserOpen) {
      return {
        browserOpen: false,
        loggedIn: false,
        currentUrl: null,
        lastError: this.lastError,
      };
    }

    let loggedIn = false;
    try {
      loggedIn = await this.isLoggedIn(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.logger.warn(`Unable to determine login status: ${message}`);
    }

    return {
      browserOpen: true,
      loggedIn,
      currentUrl: page.url(),
      lastError: this.lastError,
    };
  }

  async openSession(): Promise<void> {
    if (this.context && this.page && !this.page.isClosed()) {
      await this.ensureEditorPage(this.page);
      return;
    }

    if (this.browserLaunchPromise) {
      await this.browserLaunchPromise;
      return;
    }

    this.browserLaunchPromise = this.launchBrowser();
    try {
      await this.browserLaunchPromise;
    } finally {
      this.browserLaunchPromise = null;
    }
  }

  async closeSession(): Promise<void> {
    const context = this.context;
    this.context = null;
    this.page = null;

    if (context) {
      await context.close();
    }
  }

  async publishArticle(
    request: PublishArticleRequest,
  ): Promise<PublishArticleResponse> {
    if (!request?.title?.trim()) {
      throw new BadRequestException('`title` is required');
    }

    if (!request?.markdown?.trim()) {
      throw new BadRequestException('`markdown` is required');
    }

    const run = async (): Promise<PublishArticleResponse> => {
      await this.openSession();

      const page = this.page;
      if (!page) {
        throw new InternalServerErrorException('Browser page is not available');
      }

      await this.ensureEditorPage(page);

      const loggedIn = await this.isLoggedIn(page);
      if (!loggedIn) {
        throw new BadRequestException(
          'CSDN is not logged in. Open http://localhost:6080, log in manually, then retry.',
        );
      }

      try {
        await this.fillTitle(page, request.title.trim());
        await this.fillMarkdown(page, request.markdown);
        await this.openPublishDialog(page);

        if (request.tags?.length) {
          await this.fillTags(page, request.tags);
        }

        if (request.category?.trim()) {
          await this.fillCategory(page, request.category.trim());
        }

        if (request.summary?.trim()) {
          await this.fillSummary(page, request.summary.trim());
        }

        if (request.visibility?.trim()) {
          await this.setVisibility(page, request.visibility.trim());
        }

        await this.confirmPublish(page);

        const articleUrl = await this.waitForArticleUrl(page);
        const publishBlocker = await this.detectPublishBlocker(page);

        if (publishBlocker) {
          throw new Error(publishBlocker);
        }

        const screenshotPath = await this.takeScreenshot(page, 'publish-success');

        this.lastError = null;

        if (request.closeBrowserAfterPublish) {
          await this.closeSession();
        }

        return {
          ok: true,
          articleUrl,
          screenshotPath,
          message: articleUrl
            ? 'Article published successfully'
            : 'Publish flow completed; verify the result in the browser if needed.',
        };
      } catch (error) {
        const screenshotPath = await this.takeScreenshot(page, 'publish-failed');
        const message = error instanceof Error ? error.message : String(error);
        this.lastError = message;
        this.logger.error(`Publish failed: ${message}`);
        throw new InternalServerErrorException({
          ok: false,
          articleUrl: null,
          screenshotPath,
          message,
        });
      }
    };

    const resultPromise = this.publishChain.then(run, run);
    this.publishChain = resultPromise.then(
      () => undefined,
      () => undefined,
    );
    return resultPromise;
  }

  private async launchBrowser(): Promise<void> {
    this.logger.log(
      `Launching Chromium with profile ${this.browserStateDir} on display ${
        this.display || '(default)'
      }`,
    );

    const context = await chromium.launchPersistentContext(
      this.browserStateDir,
      {
        headless: false,
        viewport: DEFAULT_VIEWPORT,
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--no-proxy-server',
          '--proxy-server=direct://',
          '--proxy-bypass-list=*',
          '--remote-debugging-address=0.0.0.0',
          '--remote-debugging-port=9222',
        ],
      },
    );

    const page = context.pages()[0] ?? (await context.newPage());
    page.on('console', (msg) => {
      this.logger.debug(`[browser:${msg.type()}] ${msg.text()}`);
    });

    this.context = context;
    this.page = page;
    this.lastError = null;

    await this.ensureEditorPage(page);
  }

  private async ensureEditorPage(page: Page): Promise<void> {
    if (!page.url().startsWith(CSDN_EDITOR_URL)) {
      await page.goto(CSDN_EDITOR_URL, { waitUntil: 'domcontentloaded' });
    } else {
      await page.bringToFront();
    }

    await page.waitForTimeout(1200);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {
      this.logger.debug('Network idle timeout ignored while opening editor');
    });
  }

  private async isLoggedIn(page: Page): Promise<boolean> {
    await this.ensureEditorPage(page);

    const loginButton = page.getByText('登录', { exact: true });
    if (await loginButton.isVisible().catch(() => false)) {
      const titleInput = await this.findFirstVisible(page, TITLE_SELECTORS, 1500);
      return Boolean(titleInput);
    }

    const titleInput = await this.findFirstVisible(page, TITLE_SELECTORS, 3000);
    return Boolean(titleInput);
  }

  private async fillTitle(page: Page, title: string): Promise<void> {
    const locator = await this.requireVisible(page, TITLE_SELECTORS, 'title input');
    await locator.click();
    await this.clearEditable(locator);
    await locator.fill(title).catch(async () => {
      await page.keyboard.insertText(title);
    });
  }

  private async fillMarkdown(page: Page, markdown: string): Promise<void> {
    if (this.isMarkdownEditorPage(page)) {
      await this.fillMarkdownEditorPage(page, markdown);
      return;
    }

    const editorFrame = await this.findEditorFrame(page);
    if (editorFrame) {
      await this.fillRichTextFrame(editorFrame, markdown);
      return;
    }

    await this.ensureMarkdownMode(page);

    const locator = await this.requireVisible(
      page,
      CONTENT_SELECTORS,
      'markdown editor',
      6000,
    );

    await locator.click({ force: true });
    await page.keyboard.press(this.selectAllShortcut());
    await page.keyboard.press('Backspace').catch(() => undefined);
    await this.insertMarkdownContent(page, markdown);
    await page.waitForTimeout(800);
  }

  private async fillMarkdownEditorPage(
    page: Page,
    markdown: string,
  ): Promise<void> {
    const locator = await this.requireVisible(
      page,
      CONTENT_SELECTORS,
      'markdown editor',
      6000,
    );

    await locator.click({ force: true });
    await page.keyboard.press(this.selectAllShortcut()).catch(() => undefined);
    await page.keyboard.press('Backspace').catch(() => undefined);
    await page.keyboard.press('Delete').catch(() => undefined);
    await this.insertMarkdownContent(page, markdown);
    await page.waitForTimeout(1000);
  }

  private async insertMarkdownContent(
    page: Page,
    markdown: string,
  ): Promise<void> {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    for (const [index, line] of lines.entries()) {
      if (index > 0) {
        await page.keyboard.press('Enter');
      }

      if (line) {
        await page.keyboard.insertText(line);
      }

      if (index > 0 && index % 40 === 0) {
        await page.waitForTimeout(30);
      }
    }
  }

  private async fillRichTextFrame(frame: Frame, markdown: string): Promise<void> {
    const html = this.markdownToHtml(markdown);
    await frame.page().evaluate(async (content) => {
      const editor = (window as typeof window & {
        CKEDITOR?: {
          instances?: Record<
            string,
            {
              setData: (value: string, options?: { callback?: () => void }) => void;
              updateElement?: () => void;
              fire?: (name: string) => void;
            }
          >;
        };
      }).CKEDITOR?.instances?.editor;

      if (!editor) {
        throw new Error('CKEditor instance not found');
      }

      await new Promise<void>((resolve) => {
        editor.setData(content, {
          callback: () => resolve(),
        });
      });

      editor.updateElement?.();
      editor.fire?.('change');
    }, html);
    await frame.waitForTimeout(800);
  }

  private async ensureMarkdownMode(page: Page): Promise<void> {
    const switchButton = await this.findFirstVisible(
      page,
      MARKDOWN_MODE_SELECTORS,
      2000,
    );

    if (!switchButton) {
      return;
    }

    await switchButton.click();
    await page.waitForTimeout(500);

    const confirmButton = await this.findFirstVisible(
      page,
      MODE_CONFIRM_SELECTORS,
      2000,
    );

    if (confirmButton) {
      await confirmButton.click();
      await page.waitForTimeout(1200);
    }
  }

  private async openPublishDialog(page: Page): Promise<void> {
    const metadataReady = await this.findFirstVisible(
      page,
      [
        ...TAG_TRIGGER_SELECTORS,
        ...CATEGORY_TRIGGER_SELECTORS,
        ...SUMMARY_SELECTORS,
        '.modal__button-bar button:has-text("发布文章")',
        '[role="dialog"] button:has-text("发布文章")',
      ],
      1200,
    );
    if (metadataReady) {
      return;
    }

    if (this.isMarkdownEditorPage(page)) {
      const publishButton = page
        .locator('button.btn-publish')
        .filter({ hasText: '发布文章' })
        .first();

      await publishButton.waitFor({ state: 'visible', timeout: 6000 });
      await publishButton.click({ force: true });

      const publishPanel = await this.findFirstVisible(
        page,
        [
          ...TAG_TRIGGER_SELECTORS,
          ...CATEGORY_TRIGGER_SELECTORS,
          ...SUMMARY_SELECTORS,
          '.modal__button-bar button:has-text("发布文章")',
          '[role="dialog"] button:has-text("发布文章")',
        ],
        6000,
      );

      if (!publishPanel) {
        throw new Error('Unable to open publish metadata panel');
      }

      await page.waitForTimeout(800);
      return;
    }

    const directPublish = await this.findFirstVisible(
      page,
      FINAL_PUBLISH_SELECTORS,
      1500,
    );
    if (directPublish) {
      return;
    }

    const publishButton = page.getByRole('button', { name: /发布文章/ }).first();
    await publishButton.waitFor({ state: 'visible', timeout: 6000 });
    await publishButton.click();
    await page.waitForTimeout(1200);
  }

  private async fillTags(page: Page, tags: string[]): Promise<void> {
    const trigger = await this.requireVisible(
      page,
      TAG_TRIGGER_SELECTORS,
      'tag trigger',
      4000,
    );

    await trigger.click();
    const input = await this.requireVisible(page, TAG_INPUT_SELECTORS, 'tag input');

    for (const tag of tags.filter(Boolean)) {
      await input.click();
      await input.fill(tag);
      await page.waitForTimeout(400);
      await input.press('Enter');
      await page.waitForTimeout(300);
      await input.fill('').catch(() => undefined);
    }

    const closeButton = await this.findFirstVisible(
      page,
      TAG_MODAL_CLOSE_SELECTORS,
      1500,
    );
    if (closeButton) {
      await closeButton.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
  }

  private async fillCategory(page: Page, category: string): Promise<void> {
    const trigger = await this.requireVisible(
      page,
      CATEGORY_TRIGGER_SELECTORS,
      'category trigger',
      4000,
    );

    await trigger.click({ force: true }).catch(async () => {
      await trigger.evaluate((element: Element) => {
        (element as HTMLElement).click();
      });
    });
    await page.waitForTimeout(600);

    const options = await page.locator(CATEGORY_OPTION_SELECTORS[0]).evaluateAll(
      (elements) =>
        elements
          .map((element) => (element as HTMLInputElement).value.trim())
          .filter(Boolean),
    );

    const resolvedCategory = this.resolveCategoryOption(category, options);
    if (!resolvedCategory) {
      throw new Error(
        `Unable to resolve category "${category}". Available categories: ${options.join(', ')}`,
      );
    }

    await page.evaluate((target) => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input.tag__option-chk'),
      );

      for (const input of inputs) {
        if (input.checked && input.value !== target) {
          input.click();
        }
      }

      const match = inputs.find((input) => input.value === target);
      if (!match) {
        throw new Error(`Category option "${target}" not found`);
      }

      if (!match.checked) {
        match.click();
      }
    }, resolvedCategory);

    await page.waitForTimeout(500);

    const closeButton = await this.findFirstVisible(
      page,
      CATEGORY_MODAL_CLOSE_SELECTORS,
      1500,
    );
    if (closeButton) {
      await closeButton.click({ force: true }).catch(() => undefined);
    } else {
      await page.keyboard.press('Escape').catch(() => undefined);
    }

    await page.waitForTimeout(500);
  }

  private async fillSummary(page: Page, summary: string): Promise<void> {
    const locator = await this.findFirstVisible(page, SUMMARY_SELECTORS, 3000);
    if (!locator) {
      this.logger.warn('Summary textarea not found; skipping summary');
      return;
    }

    await locator.evaluate(
      (element, value) => {
        const textarea = element as HTMLTextAreaElement;
        textarea.value = '';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.value = value;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      },
      summary,
    );
  }

  private async setVisibility(page: Page, visibility: string): Promise<void> {
    const label = page.locator(`label:has-text("${visibility}")`).first();
    if (!(await label.isVisible().catch(() => false))) {
      this.logger.warn(`Visibility option "${visibility}" not found; skipping`);
      return;
    }

    const container = label.locator('..').first();
    await container.click().catch(async () => {
      await label.click();
    });
  }

  private async confirmPublish(page: Page): Promise<void> {
    const button = await this.requireVisible(
      page,
      FINAL_PUBLISH_SELECTORS,
      'final publish button',
      4000,
    );

    await button.click();
    await page.waitForTimeout(2000);
  }

  private async waitForArticleUrl(page: Page): Promise<string | null> {
    await page.waitForURL(/article\/details|blog\.csdn\.net|creation\/success/, {
      timeout: 15000,
    }).catch(() => undefined);

    const currentUrl = page.url();
    if (/article\/details|blog\.csdn\.net/.test(currentUrl)) {
      return currentUrl;
    }

    if (/creation\/success/.test(currentUrl)) {
      const viewArticleLink = page
        .locator('a:has-text("查看文章")')
        .first();
      const href = await viewArticleLink.getAttribute('href').catch(() => null);
      if (href) {
        return href;
      }
    }

    return null;
  }

  private async detectPublishBlocker(page: Page): Promise<string | null> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const quotaPrompt = page
        .getByText('当前已发文上限，可开通会员提升额度', { exact: true })
        .first();
      if (await quotaPrompt.isVisible().catch(() => false)) {
        return 'CSDN publish blocked: 当前已发文上限，可开通会员提升额度';
      }

      const genericQuotaPrompt = page.getByText('当前已发文上限').first();
      if (await genericQuotaPrompt.isVisible().catch(() => false)) {
        return 'CSDN publish blocked: 当前已发文上限';
      }

      await page.waitForTimeout(500);
    }

    return null;
  }

  private async clearEditable(locator: Locator): Promise<void> {
    await locator.press(this.selectAllShortcut()).catch(() => undefined);
    await locator.press('Backspace').catch(() => undefined);
    await locator.press('Delete').catch(() => undefined);
  }

  private async requireVisible(
    page: Page,
    selectors: string[],
    label: string,
    timeout = 5000,
  ): Promise<Locator> {
    const locator = await this.findFirstVisible(page, selectors, timeout);
    if (!locator) {
      throw new Error(`Unable to find ${label}`);
    }

    return locator;
  }

  private async findFirstVisible(
    page: Page,
    selectors: string[],
    timeout = 5000,
  ): Promise<Locator | null> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if (await locator.isVisible().catch(() => false)) {
          return locator;
        }
      }

      await page.waitForTimeout(250);
    }

    return null;
  }

  private async findEditorFrame(page: Page): Promise<Frame | null> {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) {
        continue;
      }

      const hasEditorBody = await frame
        .locator('body.cke_editable, body[contenteditable="true"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (hasEditorBody) {
        return frame;
      }
    }

    return null;
  }

  private isMarkdownEditorPage(page: Page): boolean {
    return page.url().includes('editor.csdn.net/md');
  }

  private resolveCategoryOption(
    requestedCategory: string,
    options: string[],
  ): string | null {
    const normalizedRequested = requestedCategory.trim().toLowerCase();
    const normalizedOptions = options.map((option) => ({
      raw: option,
      normalized: option.trim().toLowerCase(),
    }));

    const exact = normalizedOptions.find(
      (option) => option.normalized === normalizedRequested,
    );
    if (exact) {
      return exact.raw;
    }

    const startsWith = normalizedOptions.find((option) => {
      if (!option.normalized.startsWith(normalizedRequested)) {
        return false;
      }

      // Avoid accidentally picking private columns when the request is generic.
      return !option.normalized.includes('仅我可见');
    });
    if (startsWith) {
      return startsWith.raw;
    }

    const contains = normalizedOptions.find((option) => {
      if (!option.normalized.includes(normalizedRequested)) {
        return false;
      }

      return !option.normalized.includes('仅我可见');
    });
    if (contains) {
      return contains.raw;
    }

    return null;
  }

  private markdownToHtml(markdown: string): string {
    const escaped = markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const lines = escaped.split(/\r?\n/);
    const parts: string[] = [];
    let inList = false;

    const closeList = (): void => {
      if (inList) {
        parts.push('</ul>');
        inList = false;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        closeList();
        continue;
      }

      const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        parts.push(`<h${level}>${headingMatch[2]}</h${level}>`);
        continue;
      }

      const listMatch = /^[-*]\s+(.*)$/.exec(trimmed);
      if (listMatch) {
        if (!inList) {
          parts.push('<ul>');
          inList = true;
        }
        parts.push(`<li>${listMatch[1]}</li>`);
        continue;
      }

      closeList();
      parts.push(`<p>${trimmed}</p>`);
    }

    closeList();
    return parts.join('');
  }

  private markdownToPlainText(markdown: string): string {
    return markdown
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^[-*]\s*/gm, '• ')
      .replace(/`{1,3}/g, '')
      .trim();
  }

  private async takeScreenshot(
    page: Page,
    prefix: string,
  ): Promise<string | null> {
    try {
      const filename = `${prefix}-${Date.now()}.png`;
      const fullPath = path.join(this.screenshotsDir, filename);
      await page.screenshot({ path: fullPath, fullPage: true });
      return fullPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to save screenshot: ${message}`);
      return null;
    }
  }

  private selectAllShortcut(): string {
    return os.platform() === 'darwin' ? 'Meta+A' : 'Control+A';
  }
}
