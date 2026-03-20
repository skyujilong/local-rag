/**
 * 共享类型定义
 */

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  images: NoteImage[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteImage {
  id: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadata {
  type: 'note' | 'webpage' | 'file' | 'code';
  tags?: string[];
  author?: string;
  url?: string;
  filePath?: string;
  language?: string;
}

export interface CrawlerTask {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'waiting_auth' | 'waiting_xpath' | 'ready_crawl' | 'waiting_confirm' | 'completed' | 'failed';
  waitForAuth: boolean;
  useXPath?: boolean;
  authStatus?: 'none' | 'detected' | 'waiting_qrcode' | 'success' | 'failed';
  xpath?: string;
  previewMarkdown?: string;
  startedAt?: string;
  completedAt?: string;
  lastUpdatedAt?: string;
  error?: string;
  documentCount?: number;
  progress?: CrawlerTaskProgress;
}

export interface CrawlerTaskProgress {
  currentStep: string;
  currentStepNumber: number;
  totalSteps: number;
  progressPercentage: number;
  stepDetails?: string;
}

export interface CrawlerSession {
  domain: string;
  createdAt: string;
  updatedAt: string;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  userAgent: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface XPathSubmitRequest {
  taskId: string;
  xpath: string;
}

export interface ContentConfirmRequest {
  taskId: string;
  confirmed: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
