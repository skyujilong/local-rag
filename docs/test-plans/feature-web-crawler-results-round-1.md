# Web Crawler 测试结果报告 (Round 1)

| 文档版本 | 日期 | 作者 | 测试轮次 |
|---------|------|------|---------|
| v1.0 | 2026-04-01 | QA Engineer | Round 1 |

---

## 执行概要

- **执行时间**: 2026-04-01 14:18:21
- **测试范围**: Web Crawler 功能单元测试
- **测试文件数**: 3
- **测试用例数**: 80
- **通过数**: 73
- **失败数**: 7
- **通过率**: 91.25%
- **测试覆盖率**: 核心服务模块约 65-75% (估算)
- **总结**: 部分通过

### 测试执行详情

| 测试文件 | 总数 | 通过 | 失败 | 通过率 |
|---------|------|------|------|--------|
| content-cleaner.test.ts | 21 | 17 | 4 | 80.95% |
| url.test.ts | 59 | 56 | 3 | 94.92% |
| encryption.test.ts | 0 | 0 | 0 | N/A* |

*注: encryption.test.ts 由于 mock 配置问题导致栈溢出，未能执行。

---

## 测试结果详情

### ✅ 通过的用例 (73)

#### ContentCleanerService - 通过的测试 (17/21)

1. ✅ 应移除导航栏、页脚、侧边栏
2. ✅ 应提取 main/article 内容区域
3. ✅ 应移除 script 和 style 标签
4. ✅ 应计算正确的高质量评分
5. ✅ 应使用自定义选择器提取内容
6. ✅ 应处理空 HTML
7. ✅ 应处理没有 main content 的 HTML
8. ✅ 应正确提取标题
9. ✅ 应在没有标题时返回 "Untitled"
10. ✅ 应使用 DOMPurify 过滤 script 标签
11. ✅ 应过滤事件处理器
12. ✅ 应检测包含多个关键词的登录页
13. ✅ 不应将普通页面检测为登录页
14. ✅ 应至少需要 3 个登录关键词才触发
15. ✅ 应处理格式错误的 HTML
16. ✅ 应处理畸形 HTML
17. ✅ 应为中文字符计数

#### UrlUtil - 通过的测试 (56/59)

**URL 验证 (12/12 通过)**
1. ✅ 应接受有效的 HTTP URL
2. ✅ 应接受有效的 HTTPS URL
3. ✅ 应拒绝 FTP 协议
4. ✅ 应拒绝 file 协议
5. ✅ 应拒绝无效 URL 格式
6. ✅ 应拒绝空字符串
7. ✅ 应接受带端口的 URL
8. ✅ 应接受带路径的 URL
9. ✅ 应接受带查询参数的 URL
10. ✅ 应接受带 hash 的 URL
11. ✅ 应接受 IP 地址
12. ✅ 应接受 localhost

**URL 标准化 (9/12 通过)**
1. ✅ 默认应移除 hash
2. ✅ 默认应移除追踪参数
3. ✅ 应移除 Facebook Click ID
4. ✅ 应移除 Google Click ID
5. ✅ 应移除 Google Analytics 参数
6. ✅ 当 removeHash 为 false 时应保留 hash
7. ✅ 当 removeTrackingParams 为 false 时应保留追踪参数
8. ✅ 应处理不需要任何修改的 URL
9. ✅ 应优雅处理格式错误的 URL
10. ✅ 应标准化多个追踪参数

**重复检测 (5/5 通过)**
1. ✅ 应检测不同 hash 的重复 URL
2. ✅ 应检测不同追踪参数的重复 URL
3. ✅ 应检测带有 hash 和追踪参数的重复 URL
4. ✅ 不应将不同路径检测为重复
5. ✅ 不应将不同域检测为重复
6. ✅ 应将不同的查询参数(非追踪)视为不同

**域名提取 (5/5 通过)**
1. ✅ 应从 HTTP URL 提取域名
2. ✅ 应从 HTTPS URL 提取域名
3. ✅ 应提取带端口的域名
4. ✅ 应提取带子域名的域名
5. ✅ 应为无效 URL 返回空字符串

**同域名检查 (4/4 通过)**
1. ✅ 同域名应返回 true
2. ✅ 不同协议的同域名应返回 true
3. ✅ 不同域名应返回 false
4. ✅ 子域名与主域名应返回 false

**URL 过滤 (3/3 通过)**
1. ✅ 应过滤同域名的 URL
2. ✅ 当没有匹配项时返回空数组
3. ✅ 应处理空 URL 列表

**URL 去重 (3/4 通过)**
1. ✅ 应移除不同 hash 的重复 URL
2. ✅ 应移除不同追踪参数的重复 URL
3. ✅ 应保留不同的 URL
4. ✅ 应处理空数组

**URL 过滤规则 (7/7 通过)**
1. ✅ 未指定过滤器时应通过 URL
2. ✅ 匹配包含模式时应通过 URL
3. ✅ 不匹配包含模式时应拒绝 URL
4. ✅ 匹配排除模式时应拒绝 URL
5. ✅ 排除优先于包含
6. ✅ 应处理多个包含模式
7. ✅ 应处理多个排除模式

**Base URL 提取 (2/2 通过)**
1. ✅ 应从完整 URL 提取 base URL
2. ✅ 应处理带端口的 URL
3. ✅ 应为无效 URL 返回空字符串

---

### ❌ 失败的用例 (7)

#### 1. ContentCleanerService - 代码块和表格结构保留

**测试名称**: `should preserve code blocks and table structure`

**失败原因**: DOMPurify 默认配置移除了 `<pre>` 和 `<code>` 标签，仅保留文本内容

**错误信息**:
```
AssertionError: expected 'Documentation const x = 1; Header Data' to contain '<pre>'
```

**实际结果**: HTML 标签被移除，仅保留纯文本内容

**预期结果**: 应保留 `<pre>`, `<code>`, `<table>` 等结构标签

**严重程度**: 🟡 Medium

**影响范围**: 
- 用户爬取的代码块文档可能失去格式
- 技术文档的可读性降低

**修复建议**:
1. 更新 DOMPurify 配置，在 ALLOWED_TAGS 中添加 `<pre>`, `<code>`, `<table>`, `<tr>`, `<td>`, `<th>`, `<tbody>`, `<thead>`
2. 或者修改测试用例，调整为当前实现的行为（仅保留文本）

---

#### 2. ContentCleanerService - 低质量评分计算

**测试名称**: `should calculate low quality score for mostly navigation content`

**失败原因**: 质量评分算法的实际返回值 (0.7) 不符合测试预期 (< 0.5)

**错误信息**:
```
AssertionError: expected 0.7 to be less than 0.5
```

**实际结果**: `qualityScore = 0.7`

**预期结果**: `qualityScore < 0.5`

**严重程度**: 🟢 Low

**分析**:
- 测试用例中的 HTML 包含 `<nav>`, `<main>`, `<footer>` 三部分
- `<main>` 内容相对较少，但仍然占一定比例
- 当前算法在 ratio 为 0.3-0.7 时返回 1.0，否则返回 ratio 或 1-(ratio-0.7)
- 实际 ratio 可能在 0.3-0.7 范围内，因此返回 1.0，但经算法调整后为 0.7

**修复建议**:
1. 调整测试用例，使导航/页脚内容占比更大
2. 或调整质量评分算法的阈值
3. 或更新测试预期值

---

#### 3. ContentCleanerService - 英文单词计数

**测试名称**: `should count words correctly for English text`

**失败原因**: 实际单词数为 8，但测试预期为 7

**错误信息**:
```
AssertionError: expected 8 to be 7
```

**测试文本**: `"This is a test sentence with seven words."`

**实际结果**: 8 个单词

**预期结果**: 7 个单词

**严重程度**: 🟢 Low

**分析**:
- 单词分割正则可能将 `seven.` 拆分为 `seven` 和 `.`（两个 token）
- 或者 `seven.` 被识别为一个完整单词

**修复建议**:
1. 检查单词计数逻辑
2. 更新测试预期为 8
3. 确认单词计数的定义是否包含标点符号

---

#### 4. ContentCleanerService - 安全 HTML 标签保留

**测试名称**: `should allow safe HTML tags`

**失败原因**: DOMPurify 配置为仅保留文本内容，移除了所有 HTML 标签

**错误信息**:
```
AssertionError: expected 'Paragraph Strong Emphasis Link List item' to contain '<p>'
```

**实际结果**: 移除了所有标签，仅保留文本内容

**预期结果**: 应保留 `<p>`, `<strong>`, `<em>`, `<a>` 等安全标签

**严重程度**: 🟡 Medium

**影响范围**:
- 所有导入的网页内容失去格式
- 用户需要重新编辑格式

**修复建议**:
1. 检查 DOMPurify.sanitize 调用中的 KEEP_CONTENT 配置
2. 确保 ALLOWED_TAGS 包含需要的标签
3. 当前实现可能有意移除所有标签以简化存储，需确认产品需求

---

#### 5. UrlUtil - Trailing Slash 移除

**测试名称**: `should remove trailing slash when removeTrailingSlash is true`

**失败原因**: Vitest/Chai 不支持 `toEndWith` 匹配器

**错误信息**:
```
Error: Invalid Chai property: toEndWith
```

**严重程度**: 🟢 Low

**修复建议**:
- 将 `.toEndWith('/')` 改为 `.toMatch(/\/$/)` 或 `.endsWith('/')` (Vitest 原生)

---

#### 6. UrlUtil - Trailing Slash 保留

**测试名称**: `should preserve trailing slash by default`

**失败原因**: 同上，Vitest/Chai 不支持 `toEndWith` 匹配器

**错误信息**:
```
Error: Invalid Chai property: toEndWith
```

**严重程度**: 🟢 Low

**修复建议**:
- 同上

---

#### 7. UrlUtil - URL 去重顺序保留

**测试名称**: `should preserve order of first occurrence`

**失败原因**: 去重逻辑返回了第一个 URL 而非第三个

**错误信息**:
```
AssertionError: expected 'https://example.com/article1?utm=sour…' to be 'https://example.com/article3'
```

**实际结果**: 
```
[
  'https://example.com/article1',
  'https://example.com/article2',
  'https://example.com/article1?utm=source'  // ← 第一个 URL 的变体
]
```

**预期结果**:
```
[
  'https://example.com/article1',
  'https://example.com/article2',
  'https://example.com/article3'
]
```

**严重程度**: 🟡 Medium

**分析**:
- 去重逻辑使用 `Set` 存储标准化后的 URL
- 但返回原始 URL 列表时，可能没有正确过滤已标准化的 URL
- 第三个 URL (article1?utm=source) 被识别为与第一个 URL (article1) 重复，但仍被加入结果

**修复建议**:
1. 检查 `deduplicateUrls` 实现
2. 确保只在首次出现时添加原始 URL
3. 使用 Map 存储标准化 URL → 原始 URL 的映射

---

#### 8. EncryptionUtil - Mock 配置错误

**测试名称**: (所有测试)

**失败原因**: Mock 配置导致循环依赖和栈溢出

**错误信息**:
```
RangeError: Maximum call stack size exceeded
```

**严重程度**: 🔴 High

**影响范围**: 无法执行任何加密/解密测试

**修复建议**:
1. 修复 mock 配置，避免循环引用
2. 使用 `vi.importOriginal` 正确模拟 logger
3. 简化 mock 对象结构

---

## 发现的 Bug 列表

| Bug ID | 标题 | 严重程度 | 状态 | 模块 |
|--------|------|----------|------|------|
| BUG-1 | DOMPurify 配置移除了代码块和表格标签 | 🟡 Medium | Open | ContentCleaner |
| BUG-2 | 质量评分算法对低质量内容的评分偏高 | 🟢 Low | Open | ContentCleaner |
| BUG-3 | 单词计数可能包含标点符号 | 🟢 Low | Open | ContentCleaner |
| BUG-4 | DOMPurify 配置移除了所有 HTML 标签 | 🟡 Medium | Open | ContentCleaner |
| BUG-5 | URL 去重逻辑未正确保留首次出现的原始 URL | 🟡 Medium | Open | UrlUtil |
| BUG-6 | 加密测试的 mock 配置导致栈溢出 | 🔴 High | Open | 测试配置 |

---

## 代码覆盖率分析

基于测试用例覆盖的代码路径，估算的覆盖率：

### ContentCleanerService (~65%)

**已覆盖**:
- ✅ `cleanContent` 主流程
- ✅ `removeUnwantedElements`
- ✅ `extractTitle` (部分路径)
- ✅ `extractMainContent` (部分选择器)
- ✅ `calculateQualityScore`
- ✅ `isLoginPage`

**未覆盖**:
- ❌ `extractBySelector` 错误处理路径
- ❌ `createDocument` 浏览器环境分支
- ❌ 边界情况（超大 HTML、特殊编码）

### UrlUtil (~85%)

**已覆盖**:
- ✅ `isValid` - 所有分支
- ✅ `normalize` - 大部分配置组合
- ✅ `isDuplicate`
- ✅ `extractDomain`
- ✅ `isSameDomain`
- ✅ `filterSameDomain`
- ✅ `deduplicateUrls`
- ✅ `applyFilters`
- ✅ `extractBaseUrl`

**未覆盖**:
- ❌ `normalize` 错误处理的详细分支
- ❌ 特殊 URL 格式（如 data:, javascript:）

### EncryptionUtil (0%)

**已覆盖**: 无（测试未能执行）

**未覆盖**:
- ❌ 所有方法

### AuthSessionManagerService (0%)

**已覆盖**: 无（测试未能执行）

**未覆盖**:
- ❌ 所有方法

---

## 测试环境信息

- **操作系统**: macOS (Darwin 25.2.0)
- **Node.js 版本**: v20.x
- **测试框架**: Vitest v1.6.1
- **断言库**: Chai (集成于 Vitest)
- **Mock 框架**: Vitest vi
- **项目路径**: `/Users/jilong5/mfe-workspace/local-rag`

---

## 测试结论

### 总体评估

本次测试执行了 Web Crawler 功能的核心模块单元测试，**通过率为 91.25%**。

**优点**:
1. URL 工具类测试覆盖全面，功能稳定
2. 内容清洗服务的核心功能正常工作
3. XSS 防护机制（DOMPurify）已集成并生效

**不足**:
1. 加密和认证会话管理服务的测试未能执行
2. 部分测试用例预期与实际实现不匹配
3. HTML 标签保留功能与测试预期不符

### 风险评估

**高风险项**:
- 🔴 加密服务测试未执行，无法验证 Cookie/Token 加密存储的安全性
- 🔴 认证会话管理服务测试未执行，无法验证浏览器登录流程

**中风险项**:
- 🟡 URL 去重逻辑存在 Bug，可能导致重复导入检测不准确
- 🟡 HTML 格式保留功能不完整，影响技术文档的可读性

**低风险项**:
- 🟢 单词计数逻辑需微调
- 🟢 质量评分算法需优化

### 下一步行动

#### Round 2 测试准备

**优先级 P0 (必须完成)**:
1. [ ] 修复加密测试的 mock 配置，确保测试可执行
2. [ ] 完成加密服务的完整测试覆盖
3. [ ] 完成认证会话管理服务的测试覆盖
4. [ ] 修复 URL 去重 Bug

**优先级 P1 (重要)**:
5. [ ] 确认 HTML 标签保留的产品需求
6. [ ] 更新或修复 DOMPurify 配置
7. [ ] 调整质量评分算法或测试预期
8. [ ] 修复测试用例中的 API 使用错误

**优先级 P2 (可选)**:
9. [ ] 增加边界情况测试
10. [ ] 提高代码覆盖率到 >= 70%

### 修复后的回归测试计划

1. 修复上述 P0 和 P1 问题
2. 重新运行所有单元测试
3. 验证通过率达到 100%
4. 验证代码覆盖率达到目标
5. 进入集成测试阶段

---

## 附录

### A. 测试执行日志

```
DEV  v1.6.1 /Users/jilong5/mfe-workspace/local-rag

❯ src/shared/utils/__tests__/url.test.ts  (59 tests | 3 failed) 13ms
❯ src/server/utils/__tests__/encryption.test.ts  (0 test)
❯ src/server/services/__tests__/content-cleaner.test.ts  (21 tests | 4 failed) 135ms

Test Files  3 failed (3)
     Tests  7 failed | 73 passed (80)
  Start at  14:18:21
  Duration  983ms (transform 181ms, setup 0ms, collect 698ms, tests 148ms, environment 0ms, prepare 184ms)
```

### B. 相关文档

- 测试计划: `/docs/test-plans/feature-web-crawler.md`
- PRD: `/docs/prd/feature-web-crawler.md`
- 架构设计: `/docs/architecture/feature-web-crawler.md`

---

**报告生成时间**: 2026-04-01 14:25:00
**报告生成者**: QA Engineer (AI Assistant)
**下次测试**: Round 2 (修复后)
