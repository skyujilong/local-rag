# Web Crawler Feature Implementation

## Overview

This implementation adds a complete Web Crawler feature to the devrag-cli application, enabling users to crawl web pages, import content into their knowledge base, and manage crawling tasks.

## Architecture

### Backend Components

1. **Type Definitions** (`src/shared/types/crawler.ts`)
   - Core types for crawl modes, tasks, results, authentication
   - Enums for status tracking
   - Interfaces for all data structures

2. **Utilities**
   - `src/shared/utils/url.ts`: URL normalization and validation
   - `src/server/utils/encryption.ts`: AES-256-GCM encryption for auth credentials

3. **Database Service** (`src/server/services/crawler-db.service.ts`)
   - SQLite database management
   - Task persistence and checkpointing
   - Authentication profile storage
   - URL index for duplicate detection

4. **Content Service** (`src/server/services/content-cleaner.service.ts`)
   - HTML content extraction and cleaning
   - Quality scoring algorithm
   - XSS protection via DOMPurify

5. **Auth Session Manager** (`src/server/services/auth-session-manager.service.ts`)
   - Browser login automation
   - Cookie/Token injection
   - GUI environment detection

6. **Enhanced Crawler Service** (`src/server/services/crawler-enhanced.service.ts`)
   - Three crawling modes: single page, sitemap, recursive
   - Task scheduling and progress tracking
   - Batch crawling with memory management
   - Checkpoint-based resume capability

7. **API Routes** (`src/server/api/crawl.ts`)
   - RESTful API endpoints with Zod validation
   - Single page crawling
   - Sitemap parsing and batch crawling
   - Recursive link discovery
   - Task management (pause/resume/terminate)
   - Authentication management
   - Batch import functionality

### Frontend Components

1. **Main Views**
   - `WebCrawler.vue`: Main crawler page with tab navigation
   - `CrawlerHistory.vue`: Task history and management

2. **Crawler Components**
   - `SinglePageCrawler.vue`: Single page crawling interface
   - `SitemapCrawler.vue`: Sitemap parsing and batch crawling
   - `RecursiveCrawler.vue`: Recursive link discovery
   - `ContentPreview.vue`: Content preview before import
   - `CrawlProgress.vue`: Real-time progress monitoring
   - `AuthConfigCollapse.vue`: Authentication configuration panel

3. **Composables**
   - `useCrawlApi.ts`: API client for crawler operations

## Features Implemented

### Core Features (P0)

- ✅ Single page crawling with content extraction
- ✅ Automatic content cleaning and quality scoring
- ✅ Content preview and editing before import
- ✅ Integration with Documents feature (creates notes)
- ✅ Duplicate URL detection
- ✅ Cookie injection authentication

### Important Features (P1)

- ✅ Sitemap parsing and batch crawling
- ✅ Batch crawl progress display
- ✅ Task history and management
- ✅ Basic crawl configuration (timeout, interval, user-agent)
- ✅ Browser login authentication
- ✅ HTTP Header injection authentication
- ✅ Batch import confirmation interface
- ✅ Authentication expiry handling with resume capability
- ✅ Checkpoint-based task recovery

### Technical Features

- ✅ SQLite-based task persistence
- ✅ AES-256-GCM encryption for credentials
- ✅ Memory management (max 2 browser instances, GC every 50 pages)
- ✅ URL normalization and duplicate detection
- ✅ GUI environment detection for browser login
- ✅ Pause/resume/terminate task controls
- ✅ Quality scoring (content ratio calculation)

## API Endpoints

### Single Page Crawling
- `POST /api/crawl/single` - Crawl a single URL

### Sitemap Crawling
- `POST /api/crawl/sitemap/parse` - Parse sitemap XML
- `POST /api/crawl/sitemap/start` - Start batch crawl task

### Recursive Crawling
- `POST /api/crawl/recursive/discover` - Discover links
- `POST /api/crawl/recursive/start` - Start recursive crawl task

### Task Management
- `GET /api/crawl/tasks` - List all tasks
- `GET /api/crawl/tasks/:taskId` - Get task details
- `POST /api/crawl/tasks/:taskId/pause` - Pause task
- `POST /api/crawl/tasks/:taskId/resume` - Resume task
- `POST /api/crawl/tasks/:taskId/terminate` - Terminate task
- `DELETE /api/crawl/tasks/:taskId` - Delete task

### Authentication
- `POST /api/crawl/auth/cookie` - Save cookie auth
- `POST /api/crawl/auth/header` - Save header auth
- `POST /api/crawl/auth/launch-browser` - Launch browser login
- `POST /api/crawl/auth/complete-login` - Complete browser login
- `GET /api/crawl/auth/profiles` - List auth profiles
- `DELETE /api/crawl/auth/profiles/:profileId` - Delete auth profile

### Import
- `POST /api/crawl/import` - Batch import crawled content

### Statistics
- `GET /api/crawl/stats` - Get crawling statistics

## Database Schema

### Tables

1. **crawl_tasks**
   - Stores crawling task metadata
   - Includes mode, status, progress, config

2. **crawl_results**
   - Stores individual page crawl results
   - Links to tasks via foreign key

3. **auth_profiles**
   - Stores encrypted authentication credentials
   - Supports cookie, header, browser types

4. **task_checkpoints**
   - Stores checkpoint data for resume capability
   - JSON format for flexible data storage

5. **url_index**
   - Stores URL history for duplicate detection
   - Tracks crawl count and associated notes

## Security Features

1. **Credential Encryption**
   - AES-256-GCM encryption
   - Machine-specific key generation
   - Secure key storage (0600 permissions)

2. **XSS Protection**
   - DOMPurify sanitization on all content
   - Whitelist-based HTML tag filtering

3. **Memory Safety**
   - Browser instance limit (max 2)
   - Forced GC every 50 pages
   - RSS monitoring with auto-pause

4. **Access Control**
   - Localhost-only binding
   - No public API exposure

## Performance Constraints

- Concurrent browser instances: ≤ 2
- Batch crawling: default serial (concurrency 1)
- Request interval: ≥ 1 second
- Max pages per task: 500 (hard limit)
- GC trigger: every 50 pages
- Memory limit: 1GB RSS (auto-pause)

## Usage

### Basic Single Page Crawl

1. Navigate to `/crawler`
2. Enter URL in "单页面爬取" tab
3. Configure authentication if needed (expand "认证配置")
4. Click "爬取"
5. Preview content and edit title/tags
6. Click "导入为笔记"

### Batch Sitemap Crawl

1. Navigate to `/crawler`
2. Switch to "站点地图" tab
3. Enter sitemap URL
4. Click "解析" to discover URLs
5. Review URL list and select pages
6. Click "开始爬取"
7. Monitor progress in real-time
8. Review results in "导入确认" interface
9. Select items and set tags
10. Click "导入" to create notes

### Recursive Crawl

1. Navigate to `/crawler`
2. Switch to "递归爬取" tab
3. Enter starting URL and depth (1-3)
4. Configure URL filters (optional)
5. Click "发现链接"
6. Review discovered URLs
7. Select and start crawling
8. Same batch import flow as sitemap

### Authentication Setup

#### Cookie Injection
1. Expand "认证配置" panel
2. Switch to "Cookie 注入" tab
3. Enter domain and cookie string
4. Save profile

#### Browser Login
1. Expand "认证配置" panel
2. Switch to "浏览器登录" tab
3. Enter login page URL
4. Click "启动浏览器"
5. Complete login in popped browser window
6. Click "我已完成登录，提取认证信息"
7. Profile saved automatically

## Future Enhancements (P2)

- CSS selector precise extraction
- Failed task retry mechanism
- Custom crawl rule templates
- Content comparison and versioning
- PDF/EPUB export
- Scheduled crawling

## Testing

See `/docs/test-plans/feature-web-crawler.md` for comprehensive test plans covering:
- Unit tests for services
- Integration tests for APIs
- E2E tests for user flows
- Performance tests for constraints
- Security tests for encryption and XSS

## Troubleshooting

### Browser Login Not Available
- Check if running in SSH/Docker environment
- Verify `DISPLAY` environment variable
- Use Cookie/Header injection instead

### Memory Issues
- Reduce batch size (max 200 recommended)
- Monitor RSS in logs
- System auto-pauses at 1GB

### Authentication Expired
- Task pauses automatically
- Re-configure authentication
- Task resumes from checkpoint

### Import Failures
- Check Ollama service status
- Verify ChromaDB connection
- Review error messages in UI

## File Structure

```
src/
├── shared/
│   ├── types/
│   │   └── crawler.ts                    # Type definitions
│   └── utils/
│       └── url.ts                         # URL utilities
├── server/
│   ├── api/
│   │   ├── crawl.ts                      # Crawler API routes
│   │   └── index.ts                      # Main API (updated)
│   ├── services/
│   │   ├── crawler-db.service.ts         # Database service
│   │   ├── crawler-enhanced.service.ts   # Enhanced crawler
│   │   ├── content-cleaner.service.ts    # Content cleaning
│   │   └── auth-session-manager.service.ts # Auth management
│   └── utils/
│       └── encryption.ts                 # Encryption utilities
└── client/src/
    ├── views/
    │   ├── WebCrawler.vue                # Main crawler page
    │   └── CrawlerHistory.vue             # Task history
    └── components/
        └── crawler/
            ├── SinglePageCrawler.vue      # Single page UI
            ├── SitemapCrawler.vue         # Sitemap UI
            ├── RecursiveCrawler.vue       # Recursive UI
            ├── ContentPreview.vue         # Content preview
            ├── CrawlProgress.vue          # Progress monitoring
            ├── AuthConfigCollapse.vue     # Auth configuration
            └── composables/
                └── useCrawlApi.ts          # API composable
```

## Dependencies Added

- `better-sqlite3`: SQLite database for task/auth storage
- `@types/better-sqlite3`: TypeScript types for SQLite
- `jsdom`: DOM manipulation in Node.js for content cleaning
- `@types/jsdom`: TypeScript types for jsdom

All other dependencies were already present in the project.
