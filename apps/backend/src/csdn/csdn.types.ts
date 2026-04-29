export interface SessionStatus {
  browserOpen: boolean;
  loggedIn: boolean;
  currentUrl: string | null;
  lastError: string | null;
}

export interface PublishArticleRequest {
  title: string;
  markdown: string;
  tags?: string[];
  category?: string;
  summary?: string;
  visibility?: string;
  closeBrowserAfterPublish?: boolean;
}

export interface PublishArticleResponse {
  ok: boolean;
  articleUrl: string | null;
  screenshotPath: string | null;
  message: string;
}
