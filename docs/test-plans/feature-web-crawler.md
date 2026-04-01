# Web Crawler 测试计划

| 文档版本 | 日期 | 作者 | 变更说明 |
|---------|------|------|---------|
| v1.0 | 2026-04-01 | QA Engineer | 初始版本 |

---

## 1. 测试范围

### 1.1 功能清单

#### MVP 核心功能（P0 优先级）
- **WC-1**: 单页面爬取
  - URL 输入与验证
  - 同步阻塞式爬取
  - 内容提取与清洗
- **WC-2**: 内容自动清洗
  - 移除导航栏、页脚、侧边栏
  - 提取文章主体内容（main/article）
  - DOMPurify XSS 防护
- **WC-3**: 内容预览与确认导入
  - 标题、正文、字数、来源 URL 显示
  - 支持编辑标题和添加标签
  - 导入前确认
- **WC-4**: 导入并自动向量化
  - 创建为 Note 文档
  - 设置元数据（source: 'webpage', sourceUrl）
  - 异步触发向量化
- **WC-5**: Documents 集成
  - 爬取内容出现在笔记列表
  - 来源 URL 追溯
  - 重复导入检测
- **WC-12**: 认证与登录
  - Cookie 注入（P0）
  - 浏览器登录（P1）
  - HTTP Header 注入（P1）
  - 认证状态加密存储

#### 重要功能（P1 优先级）
- **WC-6**: 站点地图爬取
  - Sitemap XML 解析
  - URL 列表展示与选择
  - 批量爬取进度显示
- **WC-7**: 批量爬取进度显示
  - 实时进度更新（已完成/总数/失败）
  - 当前 URL 显示
  - 暂停/继续/终止操作
- **WC-8**: 爬取历史列表
  - 任务列表展示
  - 状态筛选
  - 重试失败任务
- **WC-9**: 基础爬取配置
  - 超时时间设置（默认 30s，最大 120s）
  - 请求间隔设置（最小 1s）
  - User-Agent 配置
- **WC-4b**: 批量导入确认流程
  - 爬取结果列表展示
  - 质量评分显示
  - 已导入 URL 标记
  - 批量设置标签

#### 次要功能（P2 优先级）
- **WC-10**: 递归爬取
  - 链接自动发现
  - 深度控制（1-3 级）
  - URL 过滤规则
- **WC-11**: CSS 选择器提取
  - 自定义选择器配置
  - 特定区域提取
- **WC-13**: 失败重试
  - 单页失败重试
  - 批量任务重试

### 1.2 不测试的内容

**MVP 阶段不包含的功能**
- 定时自动爬取和内容更新检测
- 自定义爬取规则模板保存
- 爬取结果对比和版本管理
- 代理服务器配置
- 爬取内容导出为 PDF/EPUB
- 复杂 SPA 页面的智能等待（需手动配置 waitForSelector）

**测试边界排除**
- 第三方网站的反爬策略对抗（仅测试合理间隔和 User-Agent）
- 目标网站的服务器稳定性
- 浏览器插件干扰
- 网络环境异常（如 DNS 污染、防火墙）

---

## 2. 测试策略

### 2.1 单元测试

**测试覆盖目标**
- 核心服务层：>= 80% 代码覆盖率
- 工具函数：100% 代码覆盖率
- API 层：>= 70% 代码覆盖率

**测试重点模块**

#### 内容清洗模块
```typescript
// 测试文件: src/server/services/__tests__/content-cleaner.test.ts
describe('ContentCleaner', () => {
  test('应移除导航栏、页脚、侧边栏')
  test('应提取 main/article 区域')
  test('应移除 script/style 标签')
  test('应保留代码块和表格结构')
  test('应计算正确的质量评分（正文占比）')
  test('DOMPurify 应过滤 XSS 攻击向量')
})
```

#### Sitemap 解析模块
```typescript
// 测试文件: src/server/services/__tests__/sitemap-parser.test.ts
describe('SitemapParser', () => {
  test('应解析标准 Sitemap XML 格式')
  test('应处理 Sitemap Index（嵌套 Sitemap）')
  test('应提取所有 <loc> URL')
  test('应处理无效 XML 格式')
  test('应处理空 Sitemap')
})
```

#### 认证管理模块
```typescript
// 测试文件: src/server/services/__tests__/auth-session-manager.test.ts
describe('AuthSessionManager', () => {
  test('应正确加密 Cookie 数据')
  test('应正确解密并注入到请求')
  test('应验证 Cookie 格式有效性')
  test('应检测认证过期（登录页特征）')
  test('应基于机器标识生成密钥')
})
```

#### URL 验证工具
```typescript
// 测试文件: src/shared/utils/__tests__/url-validator.test.ts
describe('URLValidator', () => {
  test('应接受有效的 HTTP/HTTPS URL')
  test('应拒绝非 HTTP 协议（ftp://, file://）')
  test('应标准化 URL（移除 hash、追踪参数）')
  test('应检测重复 URL（忽略 hash 和 query 追踪参数）')
})
```

### 2.2 集成测试

#### API 集成测试
```typescript
// 测试文件: src/server/api/__tests__/crawl-api.test.ts
describe('POST /api/crawl/single', () => {
  test('应成功爬取公开网页')
  test('应携带 Cookie 认证信息爬取')
  test('应返回超时错误（timeout 场景）')
  test('应处理无效 URL（400 错误）')
})

describe('POST /api/crawl/sitemap/parse', () => {
  test('应成功解析 Sitemap XML')
  test('应处理认证保护的 Sitemap')
  test('应处理 404 Sitemap URL')
})

describe('POST /api/crawl/auth/launch-browser', () => {
  test('应在有 GUI 环境启动浏览器')
  test('应在无 GUI 环境返回 noDisplay 错误')
  test('应通过 SSE 推送 browser_launched 事件')
})
```

#### Documents 集成测试
```typescript
// 测试文件: src/server/features/documents/__tests__/crawler-integration.test.ts
describe('Crawler → Documents Integration', () => {
  test('爬取内容应创建为 Note')
  test('Note 元数据应包含 source 和 sourceUrl')
  test('应检测重复 URL 并提示覆盖')
  test('应异步触发向量化')
  test('删除 Note 应同步清理向量数据')
})
```

### 2.3 E2E 测试

#### 测试框架
- **Playwright** E2E 测试（复用爬取引擎）
- 测试环境：本地开发服务器（`pnpm dev`）

#### 核心用户流程

**测试场景 1：单页面爬取完整流程**
```typescript
// tests/e2e/crawler-single-page.spec.ts
test('用户应成功爬取并导入单页面', async ({ page }) => {
  // 1. 导航到 Web Crawler 页面
  await page.goto('/crawler')
  await page.click('text=单页面爬取')

  // 2. 输入 URL 并爬取
  await page.fill('[placeholder="https://..."]', 'https://example.com/article')
  await page.click('button:has-text("Crawl")')

  // 3. 等待爬取完成（显示预览）
  await page.waitForSelector('text=Content Preview')
  await page.waitForSelector('text=Word Count')

  // 4. 编辑标题和添加标签
  await page.fill('[placeholder="Document title"]', 'Custom Title')
  await page.click('button:has-text("Add Tag")')
  await page.fill('input[placeholder="Tag name"]', 'Technology')

  // 5. 确认导入
  await page.click('button:has-text("Import as Note")')
  await page.waitForSelector('text=Imported successfully')

  // 6. 验证：跳转到笔记详情页
  expect(page.url()).toMatch(/\/documents\/[\w-]+$/)
  await page.waitForSelector('text=Custom Title')
  await page.waitForSelector('text=Source: https://example.com/article')
})
```

**测试场景 2：站点地图批量爬取流程**
```typescript
// tests/e2e/crawler-sitemap.spec.ts
test('用户应成功爬取 Sitemap 并批量导入', async ({ page }) => {
  // 1. 切换到站点地图 Tab
  await page.goto('/crawler')
  await page.click('text=站点地图')

  // 2. 输入 Sitemap URL 并解析
  await page.fill('[placeholder="Sitemap URL"]', 'https://example.com/sitemap.xml')
  await page.click('button:has-text("Parse Sitemap")')

  // 3. 等待解析完成
  await page.waitForSelector('text=Found 10 URLs')

  // 4. 全选 URL 并开始爬取
  await page.click('button:has-text("Select All")')
  await page.click('button:has-text("Start Crawl")')

  // 5. 监控进度
  await page.waitForSelector('text=Progress: 0/10')
  await page.waitForSelector('text=Progress: 10/10', { timeout: 60000 })

  // 6. 进入批量导入确认界面
  await page.waitForSelector('text=Import Confirmation')

  // 7. 取消勾选低质量页面
  await page.click('input[type="checkbox"][data-quality="low"]')

  // 8. 批量设置标签
  await page.click('button:has-text("Add Tags to All")')
  await page.fill('input[placeholder="Tag name"]', 'Documentation')

  // 9. 确认导入
  await page.click('button:has-text("Import 8 pages")')
  await page.waitForSelector('text=Import completed: 8 success, 0 failed')
})
```

**测试场景 3：浏览器登录认证流程**
```typescript
// tests/e2e/crawler-browser-login.spec.ts
test('用户应通过浏览器登录完成认证并爬取', async ({ page, context }) => {
  // 1. 展开认证配置面板
  await page.goto('/crawler')
  await page.click('text=认证配置')

  // 2. 切换到浏览器登录 Tab
  await page.click('text=浏览器登录')

  // 3. 输入登录页 URL
  await page.fill('[placeholder="https://example.com/login"]', 'https://github.com/login')
  await page.fill('[placeholder="如：个人 GitHub"]', 'Personal GitHub')

  // 4. 启动浏览器
  await page.click('button:has-text("启动浏览器并登录")')

  // 5. 等待 SSE 事件（browser_launched）
  await page.waitForSelector('text=等待您在浏览器中完成登录')

  // 6. 模拟用户在新浏览器窗口中登录
  // （实际测试需手动操作或注入 Cookie）
  const browserPages = await context.pages()
  const loginPage = browserPages[browserPages.length - 1]
  await loginPage.waitForSelector('input[name="login"]')
  await loginPage.fill('input[name="login"]', 'test-user')
  await loginPage.fill('input[name="password"]', 'test-password')
  await loginPage.click('button[type="submit"]')

  // 7. 等待用户手动确认登录完成
  // 系统不会自动检测登录成功，等待用户点击按钮
  await page.waitForSelector('text=我已完成登录，提取认证信息', { timeout: 60000 })

  // 8. 用户点击"我已完成登录，提取认证信息"按钮
  await page.click('button:has-text("我已完成登录，提取认证信息")')
  await page.waitForSelector('text=认证已保存')

  // 9. 验证：认证配置出现在列表
  await page.waitForSelector('text=Personal GitHub')
  await page.waitForSelector('text=browser')

  // 10. 使用认证爬取私有页面
  await page.goto('/crawler')
  await page.fill('[placeholder="https://..."]', 'https://github.com/private-repo/wiki')
  await page.click('button:has-text("Crawl")')
  await page.waitForSelector('text=Content Preview')
})
```

**测试场景 4：批量爬取认证过期处理**
```typescript
// tests/e2e/crawler-auth-expiry.spec.ts
test('批量爬取中认证过期应暂停并提示重新登录', async ({ page }) => {
  // 1. 配置一个即将过期的认证（模拟场景）
  await page.goto('/crawler')
  await setupExpiringAuthProfile(page)

  // 2. 启动批量爬取（50 页）
  await page.click('text=站点地图')
  await page.fill('[placeholder="Sitemap URL"]', 'https://example.com/sitemap.xml')
  await page.click('button:has-text("Parse Sitemap")')
  await page.click('button:has-text("Select All")')
  await page.click('button:has-text("Start Crawl")')

  // 3. 等待爬取进行到第 10 页（模拟认证过期）
  await page.waitForSelector('text=Progress: 10/50')

  // 4. 模拟认证过期（后端返回 auth_expired）
  await page.waitForSelector('text=认证已过期，请重新登录')

  // 5. 验证任务暂停
  await page.waitForSelector('button:has-text("Resume")')

  // 6. 点击"重新登录"
  await page.click('button:has-text("重新登录")')
  await completeBrowserLogin(page)

  // 7. 验证任务自动恢复
  await page.waitForSelector('text=Progress: 11/50')
  await page.waitForSelector('text=Progress: 50/50', { timeout: 120000 })
})
```

**测试场景 5：重复导入检测**
```typescript
// tests/e2e/crawler-duplicate-detection.spec.ts
test('应检测重复 URL 并提供覆盖/副本选项', async ({ page }) => {
  // 1. 首次爬取并导入
  await page.goto('/crawler')
  await page.fill('[placeholder="https://..."]', 'https://example.com/article')
  await page.click('button:has-text("Crawl")')
  await page.waitForSelector('text=Content Preview')
  await page.click('button:has-text("Import as Note")')
  await page.waitForSelector('text=Imported successfully')

  // 2. 再次爬取同一 URL
  await page.goto('/crawler')
  await page.fill('[placeholder="https://..."]', 'https://example.com/article')
  await page.click('button:has-text("Crawl")')
  await page.waitForSelector('text=Content Preview')

  // 3. 验证：显示重复导入提示
  await page.waitForSelector('text=该页面已于')
  await page.waitForSelector('button:has-text("覆盖更新")')
  await page.waitForSelector('button:has-text("仍然导入（创建副本）")')

  // 4. 选择"覆盖更新"
  await page.click('button:has-text("覆盖更新")')
  await page.click('button:has-text("Import as Note")')
  await page.waitForSelector('text=Imported successfully')

  // 5. 验证：文档 ID 未变，内容已更新
  const noteId = await page.evaluate(() => window.location.pathname.split('/')[2])
  expect(noteId).toBe('original-note-id') // 应与首次导入相同
})
```

### 2.4 性能测试

#### 单页面爬取性能
```typescript
// tests/performance/single-page-crawl.perf.ts
describe('Single Page Crawl Performance', () => {
  test('平均爬取时间应 < 15 秒', async () => {
    const durations: number[] = []
    for (let i = 0; i < 100; i++) {
      const start = Date.now()
      await crawlPage('https://example.com/article')
      durations.push(Date.now() - start)
    }
    const avgDuration = durations.reduce((a, b) => a + b) / durations.length
    expect(avgDuration).toBeLessThan(15000)
  })

  test('内容清洗准确率应 >= 90%', async () => {
    const testCases = [
      { url: 'https://vuejs.org/guide/', expectedQuality: 0.9 },
      { url: 'https://react.dev/learn', expectedQuality: 0.9 },
      // ... 更多测试网站
    ]
    for (const { url, expectedQuality } of testCases) {
      const result = await crawlPage(url)
      expect(result.qualityScore).toBeGreaterThanOrEqual(expectedQuality)
    }
  })
})
```

#### 批量爬取性能约束
```typescript
// tests/performance/batch-crawl-constraints.perf.ts
describe('Batch Crawl Constraints', () => {
  test('同时活跃浏览器实例数应 <= 2', async () => {
    await startLargeBatchCrawl(100)
    const maxInstances = await getMaxConcurrentBrowserInstances()
    expect(maxInstances).toBeLessThanOrEqual(2)
  })

  test('每 50 页应强制 GC 并重建实例', async () => {
    const gcEvents = await monitorGCEvents()
    await startBatchCrawl(150)
    expect(gcEvents.length).toBeGreaterThanOrEqual(3) // 50, 100, 150
  })

  test('RSS 内存超过 1GB 应暂停爬取', async () => {
    const pauseEvents = await monitorPauseEvents()
    await startMemoryIntensiveCrawl()
    const rss = await getProcessRSS()
    if (rss > 1000) {
      expect(pauseEvents.length).toBeGreaterThan(0)
    }
  })

  test('请求间隔应 >= 1 秒', async () => {
    const timestamps = await recordCrawlTimestamps(10)
    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i])
    intervals.forEach(interval => {
      expect(interval).toBeGreaterThanOrEqual(1000)
    })
  })
})
```

### 2.5 安全测试

#### 认证信息加密
```typescript
// tests/security/auth-encryption.test.ts
describe('Auth Encryption', () => {
  test('Cookie 应加密存储', async () => {
    const profile = await saveAuthProfile({
      type: 'cookie',
      domain: 'example.com',
      cookie: 'session=secret123'
    })
    const stored = await readAuthProfile(profile.id)
    expect(stored.encryptedData.cookies).not.toContain('secret123')
  })

  test('密钥应基于机器标识生成', async () => {
    const key1 = await generateEncryptionKey()
    const key2 = await generateEncryptionKey()
    expect(key1.toString('hex')).toBe(key2.toString('hex'))
  })

  test('日志应脱敏敏感信息', async () => {
    const logs = await captureLogs(() =>
      saveAuthProfile({ cookie: 'secret=123' })
    )
    logs.forEach(log => {
      expect(log).not.toContain('secret=123')
    })
  })
})
```

#### XSS 防护
```typescript
// tests/security/xss-protection.test.ts
describe('XSS Protection', () => {
  test('应过滤恶意脚本', async () => {
    const maliciousHtml = '<script>alert("XSS")</script><p>Hello</p>'
    const cleaned = await cleanContent(maliciousHtml)
    expect(cleaned).not.toContain('<script>')
    expect(cleaned).toContain('<p>Hello</p>')
  })

  test('应过滤事件处理器', async () => {
    const maliciousHtml = '<img src=x onerror="alert(1)">'
    const cleaned = await cleanContent(maliciousHtml)
    expect(cleaned).not.toContain('onerror')
  })
})
```

---

## 3. 测试用例

### 3.1 P0 用例（核心功能）

#### 用例 P0-1：单页面爬取 - 正常流程
**优先级**：P0
**前置条件**：
- 系统已启动
- Ollama 和 ChromaDB 服务运行中
- 目标网站可访问（https://example.com/article）

**测试步骤**：
1. 导航到 `/crawler` 页面
2. 确认"单页面爬取" Tab 已选中
3. 在 URL 输入框输入 `https://example.com/article`
4. 点击"Crawl"按钮
5. 等待爬取完成（按钮显示加载动画）
6. 验证显示内容预览面板
7. 验证预览包含：标题、正文摘要、字数统计、来源 URL

**预期结果**：
- 爬取在 15 秒内完成
- 预览面板正确显示爬取内容
- 字数统计 > 0
- 来源 URL 正确显示
- 质量评分 >= 0.7

**实际结果**：（执行时填写）

---

#### 用例 P0-2：单页面爬取 - URL 验证
**优先级**：P0
**前置条件**：系统已启动

**测试步骤**：
1. 导航到 `/crawler` 页面
2. 在 URL 输入框输入无效 URL：`ftp://example.com`
3. 点击"Crawl"按钮
4. 验证错误提示显示

**预期结果**：
- 按钮保持禁用状态或显示错误提示
- 错误信息："仅支持 HTTP/HTTPS 协议"或"URL 格式无效"

**实际结果**：（执行时填写）

---

#### 用例 P0-3：内容清洗 - 导航栏移除
**优先级**：P0
**前置条件**：爬取一个包含导航栏的网页（如 https://vuejs.org/guide/）

**测试步骤**：
1. 执行单页面爬取
2. 在预览面板中查看清洗后的内容
3. 搜索关键词"导航"、"菜单"、"Navigation"

**预期结果**：
- 清洗后内容不包含导航栏文本
- 保留文章主体内容
- 质量评分 >= 0.9（正文占比高）

**实际结果**：（执行时填写）

---

#### 用例 P0-4：内容预览与编辑
**优先级**：P0
**前置条件**：已完成单页面爬取，显示预览面板

**测试步骤**：
1. 在预览面板中找到标题编辑框
2. 修改标题为"Custom Title"
3. 点击"Add Tag"按钮
4. 输入标签"Technology"并按回车
5. 验证标签显示在列表中
6. 点击"Import as Note"按钮

**预期结果**：
- 标题编辑框可正常输入
- 标签添加成功并显示
- 导入按钮可点击
- 显示"Imported successfully"提示

**实际结果**：（执行时填写）

---

#### 用例 P0-5：Documents 集成 - 笔记创建
**优先级**：P0
**前置条件**：已成功导入爬取内容

**测试步骤**：
1. 导航到 `/documents` 页面
2. 在笔记列表中查找刚导入的内容
3. 点击笔记查看详情
4. 验证元数据字段

**预期结果**：
- 笔记列表显示导入的内容（标题为"Custom Title"）
- 详情页显示来源 URL
- 元数据包含 `source: 'webpage'`
- 标签"Technology"正确显示
- 内容可通过语义搜索找到

**实际结果**：（执行时填写）

---

#### 用例 P0-6：重复导入检测 - 单页面
**优先级**：P0
**前置条件**：
- 已导入 URL `https://example.com/article`

**测试步骤**：
1. 再次爬取同一 URL
2. 在预览面板点击"Import as Note"
3. 验证重复导入提示

**预期结果**：
- 显示提示："该页面已于 {date} 导入过"
- 提供"覆盖更新"和"仍然导入（创建副本）"两个选项
- 选择"覆盖更新"后，原文档内容更新，ID 不变
- 选择"创建副本"后，创建新文档，新 ID

**实际结果**：（执行时填写）

---

#### 用例 P0-7：Cookie 注入认证
**优先级**：P0
**前置条件**：
- 需要登录才能访问的页面（如私有 GitLab Wiki）
- 已获取有效的 Cookie 字符串

**测试步骤**：
1. 展开"认证配置"面板
2. 切换到"Cookie 注入" Tab
3. 输入域名：`gitlab.example.com`
4. 粘贴 Cookie 字符串（格式：`key1=value1; key2=value2`）
5. 点击"保存"按钮
6. 验证认证配置出现在列表
7. 输入私有页面 URL：`https://gitlab.example.com/private-wiki`
8. 点击"Crawl"

**预期结果**：
- Cookie 成功保存并加密
- 爬取成功获取登录后的页面内容
- 不显示"登录"相关内容

**实际结果**：（执行时填写）

---

#### 用例 P0-8：认证信息加密存储
**优先级**：P0
**前置条件**：已保存 Cookie 认证配置

**测试步骤**：
1. 打开开发者工具，切换到"Application" → "Local Storage"
2. 查找认证配置文件路径：`.devrag/auth/profiles.json`
3. 读取文件内容
4. 搜索原始 Cookie 字符串

**预期结果**：
- 文件中包含 `encryptedData` 字段
- 原始 Cookie 字符串不存在于文件中
- Cookie 已被 AES-256-GCM 加密

**实际结果**：（执行时填写）

---

#### 用例 P0-9：XSS 防护
**优先级**：P0
**前置条件**：准备包含恶意脚本的测试网页

**测试步骤**：
1. 爬取包含 `<script>alert('XSS')</script>` 的网页
2. 在预览面板中查看清洗后的内容
3. 点击"Import as Note"
4. 查看导入的笔记内容
5. 在笔记详情页执行 JavaScript（检查是否触发 alert）

**预期结果**：
- 预览内容不包含 `<script>` 标签
- 导入的笔记内容不包含恶意脚本
- 页面不执行任意 JavaScript

**实际结果**：（执行时填写）

---

### 3.2 P1 用例（重要功能）

#### 用例 P1-1：站点地图爬取 - 正常流程
**优先级**：P1
**前置条件**：
- 目标站点有 Sitemap（如 https://vuejs.org/sitemap.xml）

**测试步骤**：
1. 导航到 `/crawler` 页面
2. 切换到"站点地图" Tab
3. 输入 Sitemap URL：`https://vuejs.org/sitemap.xml`
4. 点击"Parse Sitemap"按钮
5. 等待解析完成
6. 验证显示 URL 列表和总数
7. 点击"Select All"
8. 点击"Start Crawl"按钮
9. 监控进度显示

**预期结果**：
- 解析成功显示 URL 总数（如 120）
- URL 列表可滚动查看
- 进度实时更新（已完成/总数/失败）
- 批量爬取速度 >= 5 页/分钟
- 爬取完成后进入导入确认界面

**实际结果**：（执行时填写）

---

#### 用例 P1-2：站点地图爬取 - 认证保护
**优先级**：P1
**前置条件**：
- 目标 Sitemap 需要认证
- 已配置 Cookie 认证

**测试步骤**：
1. 切换到"站点地图" Tab
2. 输入认证保护的 Sitemap URL
3. 在"认证配置"中选择已保存的认证配置
4. 点击"Parse Sitemap"

**预期结果**：
- 成功解析 Sitemap（携带认证信息）
- 不返回 401/403 错误

**实际结果**：（执行时填写）

---

#### 用例 P1-3：批量导入确认流程
**优先级**：P1
**前置条件**：已完成批量爬取（50 页）

**测试步骤**：
1. 爬取完成后自动进入"导入确认"界面
2. 验证列表显示所有爬取结果
3. 检查每行显示：标题、字数、质量评分、来源域名、状态
4. 查找已导入的 URL（灰色标记）
5. 取消勾选质量评分为"低"的页面
6. 点击"Add Tags to All"
7. 输入标签"Vue.js Documentation"
8. 点击"Import N pages"按钮

**预期结果**：
- 列表正确显示所有结果
- 已导入 URL 灰色显示，默认取消勾选
- 质量评分正确显示（高/中/低）
- 标签批量设置成功
- 导入汇总显示：成功数、失败数、跳过数

**实际结果**：（执行时填写）

---

#### 用例 P1-4：批量爬取进度显示
**优先级**：P1
**前置条件**：批量爬取进行中

**测试步骤**：
1. 启动批量爬取（100 页）
2. 观察进度条显示
3. 记录进度更新频率
4. 查看当前 URL 显示
5. 点击"Pause"按钮
6. 验证任务暂停
7. 点击"Resume"按钮
8. 验证任务继续

**预期结果**：
- 进度条实时更新（间隔 <= 1 秒）
- 显示"已完成 X/总 Y"
- 当前 URL 正确显示
- 暂停后进度停止更新
- 恢复后从暂停处继续

**实际结果**：（执行时填写）

---

#### 用例 P1-5：浏览器登录认证
**优先级**：P1
**前置条件**：
- 运行环境支持 GUI（本机桌面）
- 目标网站：https://github.com

**测试步骤**：
1. 展开"认证配置"面板
2. 切换到"浏览器登录" Tab
3. 输入登录页 URL：`https://github.com/login`
4. 输入别名：`Personal GitHub`
5. 点击"启动浏览器并登录"按钮
6. 等待本地浏览器窗口弹出
7. 在弹出窗口中手动完成登录
8. 返回应用，点击"完成登录"按钮

**预期结果**：
- 浏览器窗口成功弹出（headless: false）
- 应用显示"等待您在浏览器中完成登录"
- 登录成功后自动检测 URL 变化
- 显示"检测到登录成功，请点击下方按钮完成提取"
- 点击"完成登录"后，认证配置保存成功
- 认证配置出现在列表，类型显示为"browser"

**实际结果**：（执行时填写）

---

#### 用例 P1-6：浏览器登录 - 无 GUI 环境
**优先级**：P1
**前置条件**：
- 运行环境不支持 GUI（SSH 远程或 Docker）

**测试步骤**：
1. 展开"认证配置"面板
2. 切换到"浏览器登录" Tab
3. 输入登录页 URL
4. 点击"启动浏览器并登录"按钮

**预期结果**：
- 显示错误提示："当前环境不支持弹出浏览器，请使用 Cookie 注入方式"
- "浏览器登录" Tab 隐藏或禁用
- 仅显示"Cookie 注入"和"Header 注入" Tab

**实际结果**：（执行时填写）

---

#### 用例 P1-7：HTTP Header 注入认证
**优先级**：P1
**前置条件**：
- 目标 API 使用 Bearer Token 认证
- 已获取有效的 Token

**测试步骤**：
1. 展开"认证配置"面板
2. 切换到"Header 注入" Tab
3. 输入域名：`api.example.com`
4. 输入 Header Name：`Authorization`
5. 输入 Header Value：`Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
6. 点击"保存"按钮
7. 使用认证爬取 API 文档页面

**预期结果**：
- Header 成功保存并加密
- 爬取请求携带 `Authorization` Header
- 成功获取认证保护的内容

**实际结果**：（执行时填写）

---

#### 用例 P1-8：批量爬取认证过期处理
**优先级**：P1
**前置条件**：
- 已配置一个即将过期的认证
- 执行批量爬取（50 页）

**测试步骤**：
1. 启动批量爬取
2. 等待爬取到第 10 页（模拟认证过期）
3. 观察前端提示
4. 点击"重新登录"按钮
5. 完成浏览器登录流程
6. 验证任务自动恢复

**预期结果**：
- 显示"认证已过期，请重新登录"提示
- 提供三个选项："重新登录"、"跳过继续"、"终止任务"
- 任务暂停，已完成结果保留（0-9 页）
- 重新登录后任务从第 10 页继续
- 不重复爬取已成功的页面

**实际结果**：（执行时填写）

---

#### 用例 P1-9：爬取历史列表
**优先级**：P1
**前置条件**：已执行多次爬取任务

**测试步骤**：
1. 导航到 `/crawler/history` 页面
2. 验证列表显示所有任务
3. 检查每行显示：Task ID、Mode、URLs、Status、Progress、Created、Actions
4. 点击状态筛选下拉框
5. 选择"completed"
6. 验证仅显示已完成的任务
7. 点击某个任务的"查看结果"按钮

**预期结果**：
- 列表按时间倒序排列
- 状态标签正确显示（成功/失败/进行中）
- 筛选功能正常工作
- 查看结果弹窗显示所有爬取结果

**实际结果**：（执行时填写）

---

#### 用例 P1-10：失败任务重试
**优先级**：P1
**前置条件**：爬取历史中有失败的任务

**测试步骤**：
1. 在爬取历史列表中找到失败的任务
2. 点击"重试"按钮
3. 选择"仅重试失败的页面"
4. 验证重新爬取开始

**预期结果**：
- 创建新的爬取任务
- 仅包含失败的 URL
- 成功的页面不重复爬取

**实际结果**：（执行时填写）

---

#### 用例 P1-11：基础爬取配置
**优先级**：P1
**前置条件**：系统已启动

**测试步骤**：
1. 在单页面爬取 Tab 点击"高级配置"
2. 修改超时时间为 60 秒
3. 修改请求间隔为 2 秒
4. 修改 User-Agent 为自定义值
5. 执行爬取

**预期结果**：
- 配置保存成功
- 爬取使用新的超时时间
- 批量爬取请求间隔为 2 秒
- User-Agent 正确设置

**实际结果**：（执行时填写）

---

#### 用例 P1-12：浏览器登录 - 用户手动确认流程
**优先级**：P1
**前置条件**：
- 运行环境支持 GUI（本机桌面）
- 目标网站：https://github.com

**测试步骤**：
1. 展开"认证配置"面板
2. 切换到"浏览器登录" Tab
3. 输入登录页 URL：`https://github.com/login`
4. 输入别名：`Personal GitHub`
5. 点击"启动浏览器"按钮
6. 等待浏览器窗口弹出
7. 在浏览器窗口中手动登录（输入账号密码、验证码等）
8. 返回应用，确认登录成功后点击"我已完成登录，提取认证信息"按钮

**预期结果**：
- 浏览器窗口成功弹出
- 应用显示"浏览器已启动"和"请手动确认登录状态"提示
- 不自动检测登录成功，等待用户手动点击
- 用户点击按钮后，成功提取 Cookie 并保存认证配置
- 认证配置出现在列表，类型显示为"browser"
- Cookie 数量 > 0

**实际结果**：（执行时填写）

---

#### 用例 P1-13：断点续爬 - 认证过期恢复
**优先级**：P1
**前置条件**：
- 已配置一个即将过期的认证
- 执行批量爬取（50 页）

**测试步骤**：
1. 启动批量爬取任务
2. 等待爬取到第 10 页（模拟认证过期）
3. 观察前端提示
4. 点击"重新登录并继续"按钮
5. 完成浏览器登录流程
6. 验证任务自动恢复

**预期结果**：
- 检测到认证过期时，任务自动暂停（status: 'auth_expired'）
- 前端显示"认证已过期，请重新登录后继续"提示
- 显示进度信息：已完成 X / 总 Y 页
- 提供"重新登录并继续"、"跳过该页继续"、"终止任务"三个选项
- 重新登录后任务自动从第 10 页继续
- 不重复爬取已成功的 0-9 页
- 爬取完成后进入导入确认界面

**实际结果**：（执行时填写）

---

#### 用例 P1-14：断点续爬 - 服务崩溃恢复
**优先级**：P1
**前置条件**：
- 批量爬取任务进行中（已爬取 20 页，共 50 页）

**测试步骤**：
1. 强制终止后端服务（`kill -9 <pid>`）
2. 重新启动后端服务
3. 导航到 `/crawler/history` 页面
4. 查看任务状态
5. 点击"继续"按钮

**预期结果**：
- 服务重启后，原 `running` 状态的任务被标记为 `paused`
- 任务列表显示"已暂停（服务重启）"
- checkpoints 数据包含已完成的 20 页 URL
- 点击"继续"后任务从第 21 页继续执行
- 不重复爬取已完成的 0-20 页
- 最终成功完成全部 50 页

**实际结果**：（执行时填写）

---

#### 用例 P1-15：断点续爬 - 内存超限恢复
**优先级**：P1
**前置条件**：
- 执行大型批量爬取任务（200 页）

**测试步骤**：
1. 启动批量爬取任务
2. 监控内存使用情况
3. 当 RSS 内存接近 1GB 时
4. 观察系统行为
5. 等待内存回收后点击"继续"

**预期结果**：
- RSS > 800MB 时，日志显示"内存告警"
- RSS > 1GB 时，任务自动暂停（status: 'paused'）
- 浏览器实例强制回收（BrowserPool.forceRecycle()）
- 触发 Node.js 垃圾回收（`global.gc()`）
- 前端显示"内存超限，任务已暂停，点击继续恢复"
- 内存回收后点击"继续"，任务从断点继续执行
- 继续执行后内存占用下降到合理范围

**实际结果**：（执行时填写）

---

#### 用例 P1-16：网络错误自动重试
**优先级**：P1
**前置条件**：
- 测试环境可模拟网络超时

**测试步骤**：
1. 启动批量爬取任务
2. 在第 5 页模拟网络超时（丢包）
3. 观察重试行为
4. 3 次重试失败后，继续下一页

**预期结果**：
- 第 5 页首次失败时，标记 `retry_count = 1`
- 5 秒后自动重试
- 第 2 次失败，`retry_count = 2`
- 5 秒后再次重试
- 第 3 次失败，`retry_count = 3`，标记为永久失败
- 继续爬取第 6 页
- checkpoints.failedUrls 记录第 5 页失败信息

**实际结果**：（执行时填写）

---

#### 用例 P1-17：SQLite 事务一致性
**优先级**：P1
**前置条件**：
- SQLite 数据库已初始化

**测试步骤**：
1. 启动批量爬取任务（50 页）
2. 爬取过程中强制终止服务
3. 检查数据库状态
4. 重启服务并恢复任务

**预期结果**：
- 任务状态一致性：`crawl_tasks.current_index` 准确反映已完成数量
- 结果一致性：`crawl_results` 表中已插入的结果不丢失
- 检查点一致性：`task_checkpoints.checkpoint_data` 准确记录已完成 URL
- 无孤立记录：所有 `crawl_results` 记录都有对应的 `crawl_tasks`
- 事务回滚：终止时未提交的更改不会保存

**实际结果**：（执行时填写）

---

#### 用例 P1-18：重复 URL 快速查询
**优先级**：P1
**前置条件**：
- 已导入 1000 个网页

**测试步骤**：
1. 准备 100 个已存在的 URL
2. 调用 `POST /api/crawl/check-duplicates`
3. 测量查询响应时间

**预期结果**：
- 响应时间 < 100ms（得益于 `url_index` 表的索引）
- 返回所有重复 URL 的详细信息
- 正确标识每个 URL 的首次导入时间

**实际结果**：（执行时填写）

---

### 3.3 P2 用例（次要功能）

#### 用例 P2-1：递归爬取 - 链接发现
**优先级**：P2
**前置条件**：
- 目标站点：https://example.com/docs

**测试步骤**：
1. 导航到 `/crawler` 页面
2. 切换到"递归爬取" Tab
3. 输入起始 URL：`https://example.com/docs/index.html`
4. 设置递归深度为 2
5. 点击"Discover Links"按钮
6. 等待链接发现完成
7. 验证发现的 URL 列表

**预期结果**：
- 自动发现同域名下的子页面
- 深度不超过 2 级
- URL 列表去重
- 显示发现的 URL 总数

**实际结果**：（执行时填写）

---

#### 用例 P2-2：CSS 选择器精确提取
**优先级**：P2
**前置条件**：
- 目标网页有特定内容区域

**测试步骤**：
1. 在单页面爬取 Tab 点击"高级配置"
2. 输入 CSS 选择器：`article.main-content`
3. 执行爬取
4. 验证提取的内容

**预期结果**：
- 仅提取指定选择器内的内容
- 其他区域内容被忽略

**实际结果**：（执行时填写）

---

#### 用例 P2-3：URL 过滤规则
**优先级**：P2
**前置条件**：递归爬取场景

**测试步骤**：
1. 在递归爬取 Tab 配置 URL 过滤规则
2. 输入包含模式：`/docs/`
3. 输入排除模式：`/api/`
4. 执行链接发现

**预期结果**：
- 仅保留包含 `/docs/` 的 URL
- 排除包含 `/api/` 的 URL

**实际结果**：（执行时填写）

---

## 4. 测试数据

### 4.1 正常数据

#### 公开网页
| 类别 | URL | 特征 |
|------|-----|------|
| 技术文档站 | https://vuejs.org/guide/ | 静态 HTML，结构清晰 |
| 技术博客 | https://dev.to/t/javascript | 包含代码块和评论 |
| API 文档 | https://petstore.swagger.io/ | 动态渲染（Swagger UI） |
| 通用网站 | https://example.com/article | 标准文章结构 |
| Wiki 页面 | https://en.wikipedia.org/wiki/Web_crawler | 包含侧边栏和引用 |

#### Sitemap 文件
| 类型 | URL | URL 数量 |
|------|-----|---------|
| 标准 Sitemap | https://vuejs.org/sitemap.xml | ~120 |
| 大型 Sitemap | https://developer.mozilla.org/sitemap.xml | ~10000 |
| Sitemap Index | https://example.com/sitemap-index.xml | 嵌套多个 Sitemap |

#### 认证场景
| 类型 | 域名 | 认证方式 |
|------|------|---------|
| 私有 GitLab | gitlab.example.com | Cookie 注入 |
| 私有 GitHub | github.com | 浏览器登录 |
| API 文档 | api.example.com | Bearer Token (Header) |

### 4.2 边界数据

#### URL 边界
| 类型 | 示例 | 预期行为 |
|------|------|---------|
| 超长 URL | https://example.com/{2000 chars path} | 应拒绝或截断 |
| 包含 Hash | https://example.com/article#section1 | 应忽略 Hash |
| 包含追踪参数 | https://example.com/article?utm_source=google | 应忽略追踪参数 |
| 非标准端口 | https://example.com:8443/article | 应支持 |
| IP 地址 | https://192.168.1.1/article | 应支持 |

#### 内容边界
| 类型 | 示例 | 预期行为 |
|------|------|---------|
| 空内容 | `<html><body></body></html>` | 返回空结果 |
| 仅导航栏 | 无主体内容的页面 | 质量评分低 |
| 超大内容 | 10MB HTML 文件 | 应限制或截断 |
| 特殊字符 | 包含 Emoji、Unicode | 应正确处理 |
| 深层嵌套 | `<div><div><div>...` | 应正确提取 |

#### 性能边界
| 类型 | 数值 | 预期行为 |
|------|------|---------|
| 超时时间 | 120 秒 | 最大允许值 |
| 请求间隔 | 1 秒 | 最小允许值 |
| 批量页面数 | 500 页 | 硬上限 |
| 递归深度 | 3 级 | 最大允许值 |

### 4.3 异常数据

#### 网络异常
| 类型 | 模拟方式 | 预期行为 |
|------|---------|---------|
| DNS 失败 | 不存在的域名 | 清晰错误提示 |
| 连接超时 | 不可达 IP | 返回超时错误 |
| 404 Not Found | 错误 URL | 提示页面不存在 |
| 500 Server Error | 后端错误 | 提示服务器错误 |
| 网络限速 | 限速工具 | 应在超时时间内完成 |

#### 内容异常
| 类型 | 示例 | 预期行为 |
|------|------|---------|
| 无效 HTML | `<html><body><div>` | 容错处理 |
| 恶意脚本 | `<script>alert('XSS')</script>` | 过滤脚本 |
| 编码错误 | 非 UTF-8 编码 | 自动检测转换 |
| 重定向循环 | A → B → A | 检测并终止 |
| 登录页 | 返回登录页面 | 检测认证过期 |

#### 输入异常
| 类型 | 示例 | 预期行为 |
|------|------|---------|
| 无效 URL | `not a url` | 拒绝并提示 |
| 空 Cookie 字符串 | `` | 提示格式无效 |
| 空 Sitemap | 无 URL 的 XML | 提示空 Sitemap |
| 无效 CSS 选择器 | `[[invalid]]` | 拒绝并提示 |

---

## 5. 测试环境

### 5.1 操作系统

| 操作系统 | 版本 | 测试优先级 | 备注 |
|---------|------|-----------|------|
| **macOS** | Sonoma 14.x | P0 | 主要开发环境 |
| **Ubuntu** | 22.04 LTS | P0 | 生产环境 |
| **Windows** | Windows 11 | P1 | 部分用户使用 |
| **Docker** | Alpine Linux | P1 | 容器部署场景 |

### 5.2 浏览器

#### 爬取引擎（Playwright）
| 浏览器 | 版本 | 用途 | 测试状态 |
|--------|------|------|---------|
| **Chromium** | 最新稳定版 | 主要爬取引擎 | 必测 |
| Firefox | 最新稳定版 | 兼容性测试 | 可选 |
| WebKit | 最新稳定版 | Safari 用户 | 可选 |

#### 前端测试浏览器
| 浏览器 | 版本 | 测试优先级 | 备注 |
|--------|------|-----------|------|
| **Chrome** | 最新稳定版 | P0 | 主要浏览器 |
| **Firefox** | 最新稳定版 | P1 | 次要浏览器 |
| **Safari** | 最新稳定版 | P2 | macOS 专用 |
| **Edge** | 最新稳定版 | P2 | Windows 用户 |

### 5.3 依赖服务

| 服务 | 版本 | 用途 | 启动命令 |
|------|------|------|---------|
| **Node.js** | >= 20 | 运行时 | - |
| **SQLite3** | >= 3.40 | 任务/认证存储 | 内置于 `better-sqlite3` |
| **Ollama** | latest | 向量化服务 | `ollama serve` |
| **ChromaDB** | latest | 向量数据库 | `chroma-server` |
| **Playwright Chromium** | 最新 | 爬取引擎 | `npx playwright install chromium` |

### 5.4 测试数据准备

#### 测试环境初始化脚本

**tests/fixtures/setup.sh**
```bash
#!/bin/bash
set -e

echo "🔧 初始化测试环境..."

# 1. 清理旧数据
rm -f .devrag/crawl.db
rm -rf .devrag/auth/contexts/*

# 2. 初始化 SQLite 数据库和表结构
node tests/fixtures/init-db.js

# 3. 启动本地测试网站（包含各种测试页面）
cd tests/fixtures/test-website
python -m http.server 8080 &
TEST_SITE_PID=$!
echo "✅ 测试网站启动: http://localhost:8080 (PID: $TEST_SITE_PID)"

# 4. 启动 Mock API 服务器（模拟认证、超时等场景）
cd tests/fixtures/mock-api
node server.js &
MOCK_API_PID=$!
echo "✅ Mock API 启动: http://localhost:3001 (PID: $MOCK_API_PID)"

# 5. 插入测试认证信息到数据库
node tests/fixtures/seed-auth.js

# 6. 等待服务就绪
echo "⏳ 等待服务启动..."
sleep 3

# 7. 验证服务
curl -f http://localhost:3001/health || { echo "❌ 后端服务未就绪"; exit 1; }
curl -f http://localhost:8080 || { echo "❌ 测试网站未就绪"; exit 1; }

echo ""
echo "✅ 测试环境准备完成！"
echo ""
echo "📝 测试账号信息："
echo "   - Cookie: session=test_session_value; user_id=12345"
echo "   - Token: eyJhbGc...（测试用 Bearer Token）"
echo ""
echo "🧹 清理命令："
echo "   kill $TEST_SITE_PID $MOCK_API_PID"
echo "   rm .devrag/crawl.db"
```

**tests/fixtures/init-db.js**
```javascript
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(process.cwd(), '.devrag', 'crawl.db'));

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表结构
db.exec(`
  -- 爬取任务表
  CREATE TABLE IF NOT EXISTS crawl_tasks (
    task_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL CHECK(mode IN ('single', 'sitemap', 'recursive')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed', 'auth_expired')),
    current_index INTEGER DEFAULT 0,
    total_urls INTEGER NOT NULL,
    auth_profile_id TEXT,
    config TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    paused_at TEXT,
    error TEXT,
    FOREIGN KEY (auth_profile_id) REFERENCES auth_profiles(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON crawl_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_created ON crawl_tasks(created_at DESC);

  -- 爬取结果表
  CREATE TABLE IF NOT EXISTS crawl_results (
    result_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'pending', 'auth_expired')),
    title TEXT,
    content TEXT,
    word_count INTEGER,
    quality_score REAL CHECK(quality_score BETWEEN 0 AND 1),
    imported_at TEXT,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES crawl_tasks(task_id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_results_url ON crawl_results(task_id, url);
  CREATE INDEX IF NOT EXISTS idx_results_status ON crawl_results(task_id, status);

  -- 认证配置表
  CREATE TABLE IF NOT EXISTS auth_profiles (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('cookie', 'header', 'browser')),
    name TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    expires_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_domain ON auth_profiles(domain);
  CREATE INDEX IF NOT EXISTS idx_auth_last_used ON auth_profiles(last_used_at DESC);

  -- 断点续爬检查点表
  CREATE TABLE IF NOT EXISTS task_checkpoints (
    task_id TEXT PRIMARY KEY,
    url_index INTEGER NOT NULL,
    checkpoint_data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (task_id) REFERENCES crawl_tasks(task_id) ON DELETE CASCADE
  );

  -- URL 索引表（用于重复检测）
  CREATE TABLE IF NOT EXISTS url_index (
    url TEXT PRIMARY KEY,
    note_id TEXT,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    crawl_count INTEGER DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_url_seen ON url_index(last_seen_at DESC);
`);

console.log('✅ SQLite 数据库初始化完成');
```

**tests/fixtures/seed-auth.js**
```javascript
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(process.cwd(), '.devrag', 'crawl.db'));

// 插入测试认证配置
const stmt = db.prepare(`
  INSERT INTO auth_profiles (id, domain, type, name, encrypted_data)
  VALUES (?, ?, ?, ?, ?)
`);

// 测试 Cookie 认证
stmt.run(
  'test-cookie-auth',
  'example.com',
  'cookie',
  '测试 Cookie',
  JSON.stringify({ cookies: 'encrypted:session=test_value' })
);

// 测试 Header 认证
stmt.run(
  'test-header-auth',
  'api.example.com',
  'header',
  '测试 Header',
  JSON.stringify({ headerName: 'Authorization', headerValue: 'encrypted:Bearer token' })
);

console.log('✅ 测试认证数据插入完成');
```

#### 测试网站

1. **本地测试服务器**
   ```bash
   # 启动本地测试网站（包含各种测试页面）
   cd tests/fixtures/test-website
   python -m http.server 8080
   ```

   **测试页面清单**：
   - `simple.html`: 简单静态页面
   - `with-nav.html`: 包含导航栏的页面
   - `login.html`: 模拟登录页面
   - `timeout.html`: 模拟慢响应（5 秒延迟）
   - `404.html`: 模拟 404 页面
   - `javascript.html`: 需要 JS 渲染的页面

2. **Mock API 服务器**
   ```bash
   # 启动 Mock 服务器（模拟认证、超时等场景）
   cd tests/fixtures/mock-api
   node server.js
   ```

#### 测试认证信息

1. **测试 Cookie**
   ```
   session=test_session_value; user_id=12345
   ```

2. **测试 Bearer Token**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
   ```

---

## 6. 缺陷跟踪

### 6.1 缺陷跟踪表格

| ID | 标题 | 严重程度 | 优先级 | 状态 | 发现日期 | 负责人 |
|----|------|----------|--------|------|----------|--------|
| BUG-1 | 单页面爬取超时时间过长 | 🔴 High | P0 | Open | 2026-04-01 | - |
| BUG-2 | Sitemap 解析失败（嵌套 Sitemap） | 🟡 Medium | P1 | Open | 2026-04-01 | - |
| BUG-3 | 质量评分计算不准确 | 🟢 Low | P2 | Open | 2026-04-01 | - |
| BUG-4 | 浏览器登录 SSE 连接断开 | 🔴 High | P0 | Open | 2026-04-01 | - |
| BUG-5 | 重复导入检测未忽略 Hash | 🟡 Medium | P1 | Open | 2026-04-01 | - |

### 6.2 严重程度定义

| 等级 | 定义 | 示例 |
|------|------|------|
| 🔴 **Critical** | 系统崩溃、数据丢失、安全漏洞 | 认证信息明文存储、爬取导致系统卡死 |
| 🔴 **High** | 核心功能不可用、严重影响用户体验 | 单页面爬取失败、无法导入内容 |
| 🟡 **Medium** | 功能部分可用、有 workaround | Sitemap 解析失败、质量评分偏低 |
| 🟢 **Low** | 轻微 UI 问题、文案错误 | 标签颜色不对、提示信息不清晰 |

### 6.3 优先级定义

| 优先级 | 响应时间 | 修复时间 |
|--------|----------|----------|
| **P0** | 立即响应 | 24 小时内 |
| **P1** | 1 天内 | 3 天内 |
| **P2** | 3 天内 | 1 周内 |

### 6.4 状态流转

```
Open → In Progress → Fixed → Verified → Closed
                    ↓
                 Reopened
```

---

## 7. 测试执行计划

### 7.1 测试轮次

#### Round 1: 核心功能测试（Week 1）
- **目标**：验证 P0 用例，核心功能可用
- **范围**：单页面爬取、内容清洗、Documents 集成、Cookie 注入
- **通过标准**：P0 用例通过率 >= 90%

#### Round 2: 重要功能测试（Week 2）
- **目标**：验证 P1 用例，批量爬取稳定
- **范围**：站点地图爬取、浏览器登录、批量导入确认
- **通过标准**：P0 + P1 用例通过率 >= 85%

#### Round 3: 完整回归测试（Week 3）
- **目标**：验证所有用例，性能达标
- **范围**：全部用例 + 性能测试 + 安全测试
- **通过标准**：全部用例通过率 >= 80%，性能指标达标

#### Round 4: 发布前验证（Week 4）
- **目标**：验证修复，确保无回归
- **范围**：失败用例重测 + 边界场景
- **通过标准**：无 P0/P1 缺陷，P2 缺陷 <= 3

### 7.2 每日测试计划

| 时间 | 任务 |
|------|------|
| Day 1-2 | 环境搭建、测试数据准备 |
| Day 3-5 | P0 用例执行 |
| Day 6-8 | P1 用例执行 |
| Day 9-10 | P2 用例执行 + 性能测试 |
| Day 11-12 | 安全测试 + 缺陷修复验证 |
| Day 13-14 | 回归测试 |
| Day 15 | 发布前验证 + 测试报告 |

---

## 8. 测试交付物

### 8.1 测试报告

**测试结果报告**（每轮测试后输出）
```markdown
# Web Crawler 测试结果报告 (Round N)

## 执行概要
- 执行时间：2026-04-01 ~ 2026-04-15
- 测试用例数：120
- 通过数：108
- 失败数：12
- 通过率：90%

## 测试结果详情

### ✅ 通过的用例（108）
- P0-1: 单页面爬取 - 正常流程
- P0-2: 单页面爬取 - URL 验证
- ...

### ❌ 失败的用例（12）

#### 用例 P0-8: 认证信息加密存储
**失败原因**：Cookie 未完全加密，部分字段明文存储
**严重程度**：🔴 High
**重现步骤**：...
**错误日志**：...

## 缺陷统计
- Critical: 1
- High: 3
- Medium: 5
- Low: 3

## 下一步
- [ ] 修复 Critical/High 缺陷
- [ ] 重新测试失败用例
- [ ] 进入下一轮测试
```

### 8.2 测试数据

**测试数据集**
- URL 列表：`tests/data/urls.json`
- Sitemap 列表：`tests/data/sitemaps.json`
- 认证信息：`tests/data/auth-profiles.json`
- Mock 数据：`tests/fixtures/mock-api/`

### 8.3 自动化脚本

**E2E 测试脚本**
- `tests/e2e/crawler-single-page.spec.ts`
- `tests/e2e/crawler-sitemap.spec.ts`
- `tests/e2e/crawler-browser-login.spec.ts`
- `tests/e2e/crawler-auth-expiry.spec.ts`
- `tests/e2e/crawler-duplicate-detection.spec.ts`

**性能测试脚本**
- `tests/performance/single-page-crawl.perf.ts`
- `tests/performance/batch-crawl-constraints.perf.ts`

---

## 9. 风险与依赖

### 9.1 测试风险

| 风险项 | 影响 | 缓解措施 |
|--------|------|---------|
| 第三方网站不稳定 | 测试结果不一致 | 使用本地测试服务器 + Mock 数据 |
| 浏览器登录需要人工操作 | 自动化测试困难 | 使用注入 Cookie 模拟登录状态 |
| 性能测试耗时过长 | 测试周期延长 | 并行执行、使用小数据集 |
| 环境差异（Docker vs 本机） | 测试结果不一致 | 在多个环境分别测试 |

### 9.2 测试依赖

| 依赖项 | 版本 | 获取方式 |
|--------|------|---------|
| 测试网站 | - | 本地搭建（tests/fixtures/test-website） |
| 测试账号 | - | 开发团队提供 |
| 测试 Token | - | 开发团队提供 |
| Ollama 服务 | latest | `ollama serve` |
| ChromaDB 服务 | latest | `chroma-server` |

---

## 10. 附录

### 10.1 术语表

| 术语 | 解释 |
|------|------|
| **Sitemap** | 网站地图文件（XML 格式），列出站点所有页面 URL |
| **递归爬取** | 从起始 URL 出发，自动发现并爬取子链接的爬取方式 |
| **内容清洗** | 去除网页中的导航、广告等无关内容，提取正文 |
| **质量评分** | 0-1 分数，表示正文占比（1 表示纯正文，0 表示全无关） |
| **认证配置（Auth Profile）** | 保存的登录凭证信息（Cookie/Token），以域名区分 |
| **向量化** | 将文本转换为向量表示，用于语义搜索 |
| **SSE** | Server-Sent Events，服务器推送技术，用于浏览器登录状态推送 |

### 10.2 参考资料

**内部文档**
- `/docs/prd/feature-web-crawler.md` - Web Crawler PRD
- `/docs/architecture/feature-web-crawler.md` - 技术架构设计
- `/docs/ui-design/feature-web-crawler.md` - UI 设计文档

**外部资源**
- [Playwright 官方文档](https://playwright.dev/)
- [Naive UI 官方文档](https://www.naiveui.com/)
- [Vue 3 官方文档](https://vuejs.org/)

---

**文档结束**
