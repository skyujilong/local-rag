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
  status: 'pending' | 'running' | 'waiting_auth' | 'completed' | 'failed';
  waitForAuth: boolean;
  authStatus?: 'none' | 'detected' | 'waiting_qrcode' | 'success' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  documentCount?: number;
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
