// MCP 工具输入类型
export interface RAGQueryInput {
  query: string;
  topK?: number;
}

export interface KnowledgeSearchInput {
  keywords: string[];
}

export interface NoteLookupInput {
  title: string;
}

export interface CrawlerTriggerInput {
  url: string;
  waitForAuth?: boolean;
}

// API 响应类型
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
