import type { CrawlerConfig } from '@local-rag/shared/types';

export function getCrawlerConfig(): CrawlerConfig {
  return {
    request: {
      timeout: parseInt(process.env.CRAWLER_TIMEOUT || '30000'),
      retries: parseInt(process.env.CRAWLER_RETRIES || '3'),
      userAgent: process.env.CRAWLER_USER_AGENT || 'Local-RAG-Bot/1.0',
    },
    browser: {
      headless: process.env.CRAWLER_HEADLESS !== 'false',
      viewport: {
        width: parseInt(process.env.CRAWLER_VIEWPORT_WIDTH || '1920'),
        height: parseInt(process.env.CRAWLER_VIEWPORT_HEIGHT || '1080'),
      },
    },
    auth: {
      sessionPath: process.env.SESSION_PATH || './apps/api/data/sessions',
      credentialPath: process.env.CREDENTIAL_PATH || './apps/api/data/credentials.enc',
    },
    parsing: {
      removeSelectors: (process.env.CRAWLER_REMOVE_SELECTORS || '.ad, .sidebar, nav, footer').split(',').map(s => s.trim()),
      contentSelector: process.env.CRAWLER_CONTENT_SELECTOR || 'main, article, .content',
      extractImages: process.env.CRAWLER_EXTRACT_IMAGES === 'true',
    },
  };
}
