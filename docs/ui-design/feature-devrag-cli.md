# UI 设计文档 - devrag-cli

| 文档版本 | 日期 | 作者 | 变更说明 |
|---------|------|------|---------|
| v1.0 | 2026-03-26 | UI Designer | 初始版本 |

---

## 1. 设计原则与视觉风格

### 1.1 核心设计原则

**开发者优先（Developer-First）**
- 面向技术用户的设计语言，避免过度装饰
- 信息密度优先，强调数据展示和操作效率
- 快速访问核心功能，减少交互层级

**性能与简洁（Performance & Simplicity）**
- 纯静态 HTML/CSS/JS 实现，无构建步骤
- 轻量级设计，首屏加载 < 500ms
- 极简视觉风格，减少视觉干扰

**本地化与隐私（Local & Private）**
- 所有数据存储在本地，不上传云端
- 不包含第三方追踪和分析
- 设计风格传达"安全、私密"的感觉

**响应式与可访问（Responsive & Accessible）**
- 支持桌面和移动端访问
- 遵循 WCAG 2.1 AA 级无障碍标准
- 键盘导航友好，支持开发者习惯

### 1.2 视觉风格定义

**色彩系统**

主色调（深色主题优先）
```css
/* 背景色系 */
--bg-primary: #0d1117;      /* 主背景（GitHub Dark 风格） */
--bg-secondary: #161b22;    /* 次级背景 */
--bg-tertiary: #21262d;     /* 三级背景/卡片 */
--bg-hover: #30363d;        /* 悬停状态 */

/* 文本色系 */
--text-primary: #c9d1d9;    /* 主文本 */
--text-secondary: #8b949e;  /* 次级文本 */
--text-muted: #6e7681;      /* 弱化文本 */

/* 功能色 */
--accent-primary: #58a6ff;  /* 主强调色（蓝色） */
--accent-success: #3fb950;  /* 成功状态（绿色） */
--accent-warning: #d29922;  /* 警告状态（黄色） */
--accent-error: #f85149;    /* 错误状态（红色） */
--accent-info: #a5d6ff;     /* 信息提示（浅蓝） */

/* 边框与分割线 */
--border-default: #30363d;
--border-muted: #21262d;
```

浅色主题（可选）
```css
--bg-primary: #ffffff;
--bg-secondary: #f6f8fa;
--bg-tertiary: #eaeef2;
--text-primary: #24292f;
--text-secondary: #57606a;
--accent-primary: #0969da;
```

**排版系统**

```css
/* 字体栈 */
--font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI",
                    "Noto Sans", Helvetica, Arial, sans-serif,
                    "Apple Color Emoji", "Segoe UI Emoji";
--font-family-mono: ui-monospace, SFMono-Regular, "SF Mono",
                    Menlo, Consolas, "Liberation Mono", monospace;

/* 字体尺寸 */
--text-xs: 0.75rem;    /* 12px - 辅助信息 */
--text-sm: 0.875rem;   /* 14px - 正文 */
--text-base: 1rem;     /* 16px - 默认 */
--text-lg: 1.125rem;   /* 18px - 小标题 */
--text-xl: 1.25rem;    /* 20px - 标题 */
--text-2xl: 1.5rem;    /* 24px - 页面标题 */
--text-3xl: 1.875rem;  /* 30px - 特大标题 */

/* 行高与间距 */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

**间距系统**

```css
/* 间距单位（4px 基准网格） */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
```

**圆角与阴影**

```css
/* 圆角 */
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-full: 9999px;

/* 阴影 */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3);
```

### 1.3 图标系统

**图标库选择**
- 使用 **Lucide Icons**（轻量级、开发者友好）
- 或 **Heroicons**（Tailwind CSS 官方推荐）
- SVG 格式，支持按需加载

**核心图标集**

| 功能 | 图标 | 用途 |
|------|------|------|
| 文档 | `file-text`, `folder` | 文档列表、目录 |
| 搜索 | `search` | 搜索框 |
| 添加 | `plus`, `upload` | 导入文档 |
| 删除 | `trash-2` | 删除操作 |
| 刷新 | `refresh-cw` | 重新向量化 |
| 设置 | `settings` | 系统设置 |
| 状态 | `check-circle`, `alert-circle`, `x-circle` | 成功/警告/错误 |
| 加载 | `loader-2` | 加载动画 |
| 爬虫 | `globe`, `browser` | 网页爬取 |
| 数据库 | `database` | 向量数据库 |
| 代码 | `code`, `terminal` | CLI 相关 |

---

## 2. 页面结构与导航

### 2.1 整体布局

**应用布局结构**

```
┌─────────────────────────────────────────────────────────┐
│  Header（固定顶部）                                       │
│  Logo | 导航菜单 | 系统状态指示器                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Main Content（可滚动区域）                               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  页面内容                                          │  │
│  │  - 文档列表页                                      │  │
│  │  - 搜索页                                          │  │
│  │  - 系统监控页                                      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Footer（可选）                                          │
│  版本信息 | 快捷链接                                      │
└─────────────────────────────────────────────────────────┘
```

**移动端布局（响应式）**

```
┌─────────────────────────┐
│  Header                 │
│  Hamburger | Logo | Icon│
├─────────────────────────┤
│                         │
│  Main Content           │
│  (全屏显示)              │
│                         │
├─────────────────────────┤
│  Bottom Navigation      │
│  (固定底部导航)          │
└─────────────────────────┘
```

### 2.2 导航架构

**主导航菜单（桌面端）**

```
顶部导航栏（水平布局）
┌─────────────────────────────────────────────────────────┐
│ [devrag-cli]                                          │
│                                                         │
│ [文档库] [搜索] [爬虫] [系统]                          │
│                                                         │
│                         [状态指示器]                     │
└─────────────────────────────────────────────────────────┘
```

**导航项定义**

| 导航项 | 路由 | 图标 | 描述 |
|--------|------|------|------|
| 文档库 | `#/documents` | `folder` | 文档列表和管理 |
| 搜索 | `#/search` | `search` | 语义搜索界面 |
| 爬虫 | `#/crawler` | `globe` | 网页爬取管理 |
| 系统 | `#/system` | `settings` | 系统状态和配置 |

**移动端导航（底部标签栏）**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Main Content (全屏)                                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [文档库] [搜索] [爬虫] [系统]                           │
│   📁      🔍     🌐     ⚙️                            │
└─────────────────────────────────────────────────────────┘
```

### 2.3 路由设计

**Hash 路由（无服务器配置）**

```javascript
// 路由配置
const routes = {
  '/': { redirect: '/documents' },
  '/documents': { page: 'documents' },
  '/search': { page: 'search' },
  '/crawler': { page: 'crawler' },
  '/system': { page: 'system' }
};

// 路由守卫（可选）
// - 检查服务状态
// - 检查 Ollama 连接
```

**面包屑导航（子页面）**

```
文档库 > [文档详情]
搜索 > [查询结果]
爬虫 > [任务详情]
```

---

## 3. 核心页面设计

### 3.1 文档库页面（Documents）

**页面布局**

```
┌─────────────────────────────────────────────────────────┐
│  文档库                                    [+ 导入文档]  │
├─────────────────────────────────────────────────────────┤
│  筛选和搜索                                              │
│  [搜索框] [标签筛选 ▼] [来源筛选 ▼] [排序 ▼]           │
├─────────────────────────────────────────────────────────┤
│  批量操作工具栏（选中时显示）                             │
│  已选中 3 项  [重新向量化] [删除]                        │
├─────────────────────────────────────────────────────────┤
│  文档列表                                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ☐  文档标题                    标签: React, Hooks │  │
│  │     来源: ~/notes/react.md                        │  │
│  │     向量数: 12 | 更新: 2小时前                     │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ ☑  Vue 3 Composition API     标签: Vue           │  │
│  │     来源: Obsidian Vault                          │  │
│  │     向量数: 8 | 更新: 1天前                        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**文档列表项设计**

**文档卡片组件**

```html
<div class="document-card">
  <!-- 复选框 -->
  <input type="checkbox" class="doc-checkbox" />

  <!-- 文档信息 -->
  <div class="doc-info">
    <h3 class="doc-title">React Hooks 完全指南</h3>

    <div class="doc-meta">
      <span class="doc-source">
        <i class="icon-file"></i>
        ~/notes/react-hooks.md
      </span>
      <span class="doc-vectors">
        <i class="icon-database"></i>
        12 个向量
      </span>
      <span class="doc-updated">
        <i class="icon-clock"></i>
        2 小时前
      </span>
    </div>

    <div class="doc-tags">
      <span class="tag tag-blue">React</span>
      <span class="tag tag-purple">Hooks</span>
      <span class="tag tag-green">前端</span>
    </div>
  </div>

  <!-- 操作按钮 -->
  <div class="doc-actions">
    <button class="btn-icon" title="重新向量化">
      <i class="icon-refresh"></i>
    </button>
    <button class="btn-icon" title="删除">
      <i class="icon-trash"></i>
    </button>
  </div>
</div>
```

**样式规范**

```css
.document-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.document-card:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-md);
}

.document-card.selected {
  background: rgba(88, 166, 255, 0.1);
  border-color: var(--accent-primary);
}

.doc-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.doc-meta {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.doc-meta span {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.doc-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tag {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.tag-blue { background: rgba(88, 166, 255, 0.2); color: var(--accent-primary); }
.tag-purple { background: rgba(165, 119, 255, 0.2); color: #a575ff; }
.tag-green { background: rgba(63, 185, 80, 0.2); color: var(--accent-success); }
```

**导入文档对话框**

```
┌─────────────────────────────────────────────────────────┐
│  导入文档                                    [×]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  选择导入方式：                                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📄 本地 Markdown 文件                          │   │
│  │  导入单个或批量导入 .md 文件                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📁 Obsidian 笔记库                             │   │
│  │  导入整个 Obsidian Vault 目录                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  🌐 网页爬取                                    │   │
│  │  爬取在线文档页面（需要配置爬虫）                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                   [取消]  [下一步]      │
└─────────────────────────────────────────────────────────┘
```

### 3.2 搜索页面（Search）

**页面布局**

```
┌─────────────────────────────────────────────────────────┐
│  智能搜索                                                │
├─────────────────────────────────────────────────────────┤
│  搜索框                                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔍 请输入您的问题...                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  搜索选项（可展开）                                      │
│  ▼ 高级选项                                            │
│    返回数量: [3 ▼]  相似度阈值: [0.7 ▼]               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  搜索结果                                                │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  结果 1 - 相关度: 92%                             │  │
│  │  React Hooks 状态管理最佳实践                     │  │
│  │  来源: ~/notes/react-hooks.md                     │  │
│  │  ─────────────────────────────────────────        │  │
│  │  在 React 中使用 useState 和 useReducer 可以...   │  │
│  │  ...实现高效的状态管理。当状态逻辑复杂时...       │  │
│  │  [高亮匹配] 推荐使用 useReducer 替代多个 useState │  │
│  │                                                         │
│  │  [查看完整文档] [复制片段] [重新生成]              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  结果 2 - 相关度: 87%                             │  │
│  │  Vue 3 Composition API vs Options API             │  │
│  │  来源: Obsidian/vue3-comparison.md                │  │
│  │  ─────────────────────────────────────────        │  │
│  │  Vue 3 的 Composition API 提供了更好的...        │  │
│  │  [查看完整文档] [复制片段]                        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**搜索框设计**

```html
<div class="search-container">
  <div class="search-box">
    <i class="icon-search"></i>
    <input
      type="text"
      placeholder="请输入您的问题..."
      class="search-input"
      autofocus
    />
    <button class="search-button" title="搜索">
      <i class="icon-arrow-right"></i>
    </button>
  </div>

  <!-- 搜索建议/历史记录（下拉） -->
  <div class="search-suggestions" style="display: none;">
    <div class="suggestion-item">
      <i class="icon-history"></i>
      React Hooks 最佳实践
    </div>
    <div class="suggestion-item">
      <i class="icon-history"></i>
      Vue 3 响应式原理
    </div>
  </div>
</div>
```

```css
.search-container {
  position: relative;
  max-width: 800px;
  margin: 0 auto;
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-tertiary);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-lg);
  transition: all 0.3s ease;
}

.search-box:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-lg);
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-button {
  padding: var(--space-2) var(--space-4);
  background: var(--accent-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.search-button:hover {
  background: #4c9aed;
  transform: translateY(-1px);
}
```

**搜索结果卡片**

```html
<div class="search-result">
  <!-- 结果头部 -->
  <div class="result-header">
    <div class="result-rank">
      <span class="rank-badge">1</span>
      <span class="rank-score">92% 相关度</span>
    </div>
    <div class="result-actions">
      <button class="btn-icon" title="复制">
        <i class="icon-copy"></i>
      </button>
      <button class="btn-icon" title="收藏">
        <i class="icon-star"></i>
      </button>
    </div>
  </div>

  <!-- 文档标题 -->
  <h3 class="result-title">React Hooks 状态管理最佳实践</h3>

  <!-- 文档来源 -->
  <div class="result-source">
    <i class="icon-file"></i>
    ~/notes/react-hooks.md
  </div>

  <!-- 匹配片段 -->
  <div class="result-content">
    在 React 中使用 <mark>useState</mark> 和 <mark>useReducer</mark>
    可以实现高效的状态管理。当状态逻辑复杂时，推荐使用
    <mark>useReducer</mark> 替代多个 <mark>useState</mark> 调用...
  </div>

  <!-- 操作按钮 -->
  <div class="result-footer">
    <button class="btn-text">查看完整文档</button>
    <button class="btn-text">复制片段</button>
    <button class="btn-text">重新生成</button>
  </div>
</div>
```

```css
.search-result {
  padding: var(--space-5);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
  transition: all 0.2s ease;
}

.search-result:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-md);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--accent-primary);
  color: white;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: var(--text-sm);
}

.rank-score {
  margin-left: var(--space-2);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.result-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.result-source {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
}

.result-content {
  padding: var(--space-3);
  background: var(--bg-secondary);
  border-left: 3px solid var(--accent-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.result-content mark {
  background: rgba(88, 166, 255, 0.3);
  color: var(--accent-info);
  padding: 0 2px;
  border-radius: 2px;
}

.result-footer {
  display: flex;
  gap: var(--space-3);
}

.btn-text {
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-text:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
```

**空状态设计**

```html
<div class="empty-state">
  <div class="empty-icon">
    <i class="icon-search"></i>
  </div>
  <h3 class="empty-title">开始搜索您的知识库</h3>
  <p class="empty-description">
    输入问题或关键词，AI 将从您的文档中找到最相关的内容
  </p>
  <div class="empty-suggestions">
    <span class="suggestion-label">试试搜索：</span>
    <button class="suggestion-chip">React Hooks 最佳实践</button>
    <button class="suggestion-chip">Vue 3 响应式原理</button>
    <button class="suggestion-chip">TypeScript 类型推断</button>
  </div>
</div>
```

```css
.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}

.empty-icon {
  font-size: 64px;
  color: var(--text-muted);
  margin-bottom: var(--space-6);
}

.empty-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.empty-description {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
}

.empty-suggestions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.suggestion-chip {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggestion-chip:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  transform: translateY(-2px);
}
```

### 3.3 爬虫管理页面（Crawler）

**页面布局**

```
┌─────────────────────────────────────────────────────────┐
│  网页爬虫                                   [+ 新建任务] │
├─────────────────────────────────────────────────────────┤
│  爬虫任务列表                                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │  任务: 公司技术文档爬取                            │  │
│  │  状态: ● 运行中 (3/10 完成)                        │  │
│  │  进度: ████████░░░ 80%                            │  │
│  │  创建: 2小时前 | 更新: 5分钟前                     │  │
│  │                                                     │  │
│  │  [暂停] [查看日志] [删除]                          │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  任务: Notion 知识库同步                           │  │
│  │  状态: ✓ 已完成 (15/15)                            │  │
│  │  完成时间: 1天前                                   │  │
│  │                                                     │  │
│  │  [重新运行] [查看详情] [删除]                      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**爬虫任务卡片**

```html
<div class="crawler-task">
  <!-- 任务头部 -->
  <div class="task-header">
    <div class="task-info">
      <h3 class="task-title">公司技术文档爬取</h3>
      <div class="task-meta">
        <span class="task-created">创建于 2 小时前</span>
        <span class="task-updated">更新于 5 分钟前</span>
      </div>
    </div>
    <div class="task-status">
      <span class="status-badge status-running">
        <i class="icon-loader"></i>
        运行中
      </span>
    </div>
  </div>

  <!-- 进度条 -->
  <div class="task-progress">
    <div class="progress-bar">
      <div class="progress-fill" style="width: 80%;"></div>
    </div>
    <div class="progress-text">
      <span>3/10 页面已完成</span>
      <span class="progress-percent">80%</span>
    </div>
  </div>

  <!-- 统计信息 -->
  <div class="task-stats">
    <div class="stat-item">
      <span class="stat-label">成功</span>
      <span class="stat-value stat-success">3</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">失败</span>
      <span class="stat-value stat-error">0</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">待处理</span>
      <span class="stat-value stat-pending">7</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">向量化</span>
      <span class="stat-value stat-vectors">156</span>
    </div>
  </div>

  <!-- 操作按钮 -->
  <div class="task-actions">
    <button class="btn-secondary">
      <i class="icon-pause"></i>
      暂停
    </button>
    <button class="btn-secondary">
      <i class="icon-file-text"></i>
      查看日志
    </button>
    <button class="btn-danger">
      <i class="icon-trash"></i>
      删除
    </button>
  </div>
</div>
```

```css
.crawler-task {
  padding: var(--space-5);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.task-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.task-meta {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
}

.status-running {
  background: rgba(88, 166, 255, 0.2);
  color: var(--accent-primary);
}

.status-running .icon-loader {
  animation: spin 1s linear infinite;
}

.status-completed {
  background: rgba(63, 185, 80, 0.2);
  color: var(--accent-success);
}

.status-error {
  background: rgba(248, 81, 73, 0.2);
  color: var(--accent-error);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.task-progress {
  margin-bottom: var(--space-4);
}

.progress-bar {
  height: 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-info));
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.task-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.stat-value {
  display: block;
  font-size: var(--text-lg);
  font-weight: 600;
}

.stat-success { color: var(--accent-success); }
.stat-error { color: var(--accent-error); }
.stat-pending { color: var(--text-muted); }
.stat-vectors { color: var(--accent-primary); }

.task-actions {
  display: flex;
  gap: var(--space-3);
}

.btn-secondary {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.btn-danger {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: 1px solid var(--accent-error);
  border-radius: var(--radius-md);
  color: var(--accent-error);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover {
  background: var(--accent-error);
  color: white;
}
```

**新建爬虫任务对话框**

```html
<div class="dialog-overlay">
  <div class="dialog">
    <div class="dialog-header">
      <h2>新建爬虫任务</h2>
      <button class="dialog-close">
        <i class="icon-x"></i>
      </button>
    </div>

    <div class="dialog-body">
      <!-- 任务名称 -->
      <div class="form-group">
        <label class="form-label">任务名称</label>
        <input
          type="text"
          class="form-input"
          placeholder="例如: 公司技术文档爬取"
        />
      </div>

      <!-- URL 输入 -->
      <div class="form-group">
        <label class="form-label">目标 URL</label>
        <textarea
          class="form-textarea"
          placeholder="输入 URL，每行一个&#10;https://docs.company.com/page1&#10;https://docs.company.com/page2"
          rows="4"
        ></textarea>
        <span class="form-hint">
          支持 CSV 文件导入或直接粘贴 URL 列表
        </span>
      </div>

      <!-- 认证配置 -->
      <div class="form-group">
        <label class="form-label">
          <input type="checkbox" />
          需要登录认证
        </label>
      </div>

      <!-- Cookie 配置（条件显示） -->
      <div class="form-group auth-config" style="display: none;">
        <label class="form-label">Cookie 字符串</label>
        <textarea
          class="form-textarea"
          placeholder="session_id=xxx; auth_token=yyy"
          rows="2"
        ></textarea>
      </div>

      <!-- 高级选项 -->
      <details class="form-details">
        <summary>高级选项</summary>

        <div class="form-group">
          <label class="form-label">并发请求数</label>
          <input
            type="number"
            class="form-input"
            value="3"
            min="1"
            max="10"
          />
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" checked />
            自动向量化爬取的内容
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" />
            仅提取主要内容（去除导航、广告）
          </label>
        </div>
      </details>
    </div>

    <div class="dialog-footer">
      <button class="btn-secondary">取消</button>
      <button class="btn-primary">创建任务</button>
    </div>
  </div>
</div>
```

### 3.4 系统监控页面（System）

**页面布局**

```
┌─────────────────────────────────────────────────────────┐
│  系统状态                                                │
├─────────────────────────────────────────────────────────┤
│  服务状态                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Web 服务     │  │ Ollama      │  │ ChromaDB    │  │
│  │ ● 运行中     │  │ ● 已连接    │  │ ● 正常      │  │
│  │ 端口: 3000   │  │ 模型: nomic │  │ 文档: 128   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│  资源使用                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  内存使用 ████████░░░░░░░░░░ 320MB / 500MB      │   │
│  │  CPU 使用 ░░░░░░░░░░░░░░░░░ 2%                  │   │
│  │  磁盘使用 ██████░░░░░░░░░░░ 128MB / 1GB         │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  知识库统计                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 文档总数     │  │ 向量总数     │  │ 查询次数     │  │
│  │ 128          │  │ 1,536        │  │ 2,847        │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
├─────────────────────────────────────────────────────────┤
│  最近活动                                                │
│  • 2分钟前: 完成 "React Hooks" 的向量化                │
│  • 5分钟前: 用户查询 "Vue 3 响应式原理"                │
│  • 10分钟前: 爬虫任务 "公司文档" 完成 3 个页面          │
└─────────────────────────────────────────────────────────┘
```

**状态卡片设计**

```html
<div class="status-cards">
  <!-- Web 服务状态 -->
  <div class="status-card status-ok">
    <div class="status-icon">
      <i class="icon-server"></i>
    </div>
    <div class="status-info">
      <h4>Web 服务</h4>
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span class="status-text">运行中</span>
      </div>
      <div class="status-details">
        端口: 3000 | 运行时间: 2h 15m
      </div>
    </div>
  </div>

  <!-- Ollama 状态 -->
  <div class="status-card status-ok">
    <div class="status-icon">
      <i class="icon-cpu"></i>
    </div>
    <div class="status-info">
      <h4>Ollama</h4>
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span class="status-text">已连接</span>
      </div>
      <div class="status-details">
        模型: nomic-embed-text (384维)
      </div>
    </div>
  </div>

  <!-- ChromaDB 状态 -->
  <div class="status-card status-ok">
    <div class="status-icon">
      <i class="icon-database"></i>
    </div>
    <div class="status-info">
      <h4>ChromaDB</h4>
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span class="status-text">正常</span>
      </div>
      <div class="status-details">
        文档: 128 | 向量: 1,536
      </div>
    </div>
  </div>
</div>
```

```css
.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.status-card {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.status-card:hover {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-md);
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 24px;
  color: var(--text-secondary);
}

.status-ok .status-icon {
  background: rgba(63, 185, 80, 0.2);
  color: var(--accent-success);
}

.status-error .status-icon {
  background: rgba(248, 81, 73, 0.2);
  color: var(--accent-error);
}

.status-info h4 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--accent-success);
  animation: pulse 2s ease-in-out infinite;
}

.status-error .status-dot {
  background: var(--accent-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.status-details {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
```

**资源监控卡片**

```html
<div class="resource-monitor">
  <h3 class="monitor-title">资源使用</h3>

  <!-- 内存使用 -->
  <div class="resource-item">
    <div class="resource-header">
      <span class="resource-label">内存使用</span>
      <span class="resource-value">320MB / 500MB</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 64%;"></div>
    </div>
  </div>

  <!-- CPU 使用 -->
  <div class="resource-item">
    <div class="resource-header">
      <span class="resource-label">CPU 使用</span>
      <span class="resource-value">2%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill progress-low" style="width: 2%;"></div>
    </div>
  </div>

  <!-- 磁盘使用 -->
  <div class="resource-item">
    <div class="resource-header">
      <span class="resource-label">磁盘使用</span>
      <span class="resource-value">128MB / 1GB</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill progress-medium" style="width: 12.8%;"></div>
    </div>
  </div>
</div>
```

```css
.resource-monitor {
  padding: var(--space-5);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-6);
}

.monitor-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.resource-item {
  margin-bottom: var(--space-4);
}

.resource-item:last-child {
  margin-bottom: 0;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.resource-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.resource-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.progress-low {
  background: var(--accent-success);
}

.progress-medium {
  background: var(--accent-warning);
}

.progress-high {
  background: var(--accent-error);
}
```

**知识库统计卡片**

```html
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon">
      <i class="icon-file-text"></i>
    </div>
    <div class="stat-content">
      <div class="stat-value">128</div>
      <div class="stat-label">文档总数</div>
    </div>
  </div>

  <div class="stat-card">
    <div class="stat-icon">
      <i class="icon-database"></i>
    </div>
    <div class="stat-content">
      <div class="stat-value">1,536</div>
      <div class="stat-label">向量总数</div>
    </div>
  </div>

  <div class="stat-card">
    <div class="stat-icon">
      <i class="icon-search"></i>
    </div>
    <div class="stat-content">
      <div class="stat-value">2,847</div>
      <div class="stat-label">查询次数</div>
    </div>
  </div>
</div>
```

```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 24px;
  color: var(--accent-primary);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  margin-bottom: var(--space-1);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
```

**活动时间线**

```html
<div class="activity-timeline">
  <h3 class="timeline-title">最近活动</h3>

  <div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-content">
      <div class="timeline-time">2 分钟前</div>
      <div class="timeline-text">
        完成 <strong>"React Hooks"</strong> 的向量化
      </div>
      <div class="timeline-meta">12 个向量已生成</div>
    </div>
  </div>

  <div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-content">
      <div class="timeline-time">5 分钟前</div>
      <div class="timeline-text">
        用户查询 <strong>"Vue 3 响应式原理"</strong>
      </div>
      <div class="timeline-meta">返回 3 个结果，用时 0.8s</div>
    </div>
  </div>

  <div class="timeline-item">
    <div class="timeline-dot"></div>
    <div class="timeline-content">
      <div class="timeline-time">10 分钟前</div>
      <div class="timeline-text">
        爬虫任务 <strong>"公司文档"</strong> 完成 3 个页面
      </div>
      <div class="timeline-meta">成功率: 100%</div>
    </div>
  </div>
</div>
```

```css
.activity-timeline {
  padding: var(--space-5);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.timeline-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.timeline-item {
  display: flex;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
  position: relative;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 24px;
  bottom: 0;
  width: 2px;
  background: var(--border-muted);
}

.timeline-dot {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  background: var(--accent-primary);
  border: 2px solid var(--bg-tertiary);
  flex-shrink: 0;
  margin-top: 4px;
}

.timeline-content {
  flex: 1;
}

.timeline-time {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}

.timeline-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.timeline-text strong {
  font-weight: 600;
  color: var(--accent-primary);
}

.timeline-meta {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
```

---

## 4. 组件设计规范

### 4.1 按钮组件

**按钮类型**

```html
<!-- 主按钮 -->
<button class="btn btn-primary">
  主要操作
</button>

<!-- 次要按钮 -->
<button class="btn btn-secondary">
  次要操作
</button>

<!-- 危险按钮 -->
<button class="btn btn-danger">
  删除
</button>

<!-- 图标按钮 -->
<button class="btn btn-icon" title="刷新">
  <i class="icon-refresh"></i>
</button>

<!-- 文本按钮 -->
<button class="btn btn-text">
  文本链接
</button>
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
}

.btn-primary:hover {
  background: #4c9aed;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.btn-danger {
  background: transparent;
  border: 1px solid var(--accent-error);
  color: var(--accent-error);
}

.btn-danger:hover {
  background: var(--accent-error);
  color: white;
}

.btn-icon {
  padding: var(--space-2);
  background: transparent;
  border: none;
  color: var(--text-secondary);
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-text {
  padding: 0;
  background: transparent;
  border: none;
  color: var(--accent-primary);
}

.btn-text:hover {
  text-decoration: underline;
}

/* 禁用状态 */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 加载状态 */
.btn.loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.btn.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
```

### 4.2 表单组件

**输入框**

```html
<div class="form-group">
  <label class="form-label" for="input">
    标签文本
  </label>
  <input
    type="text"
    id="input"
    class="form-input"
    placeholder="请输入..."
  />
  <span class="form-hint">
    辅助说明文本
  </span>
</div>
```

```css
.form-group {
  margin-bottom: var(--space-4);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all 0.2s ease;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--text-muted);
}

.form-input:disabled,
.form-textarea:disabled,
.form-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-hint {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-2);
}

.form-error {
  display: block;
  font-size: var(--text-xs);
  color: var(--accent-error);
  margin-top: var(--space-2);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: var(--font-family-base);
}
```

**复选框和单选框**

```html
<div class="form-group">
  <label class="checkbox-label">
    <input type="checkbox" class="checkbox" />
    <span>复选框选项</span>
  </label>
</div>

<div class="form-group">
  <label class="radio-label">
    <input type="radio" name="group" class="radio" />
    <span>单选框选项</span>
  </label>
</div>
```

```css
.checkbox-label,
.radio-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.checkbox,
.radio {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio {
  border-radius: var(--radius-full);
}

.checkbox:checked,
.radio:checked {
  border-color: var(--accent-primary);
  background: var(--accent-primary);
}

.checkbox:checked::after {
  content: '✓';
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.radio:checked::after {
  content: '';
  display: block;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: white;
  margin: 3px;
}

.checkbox:focus,
.radio:focus {
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
}
```

### 4.3 反馈组件

**Toast 通知**

```html
<div class="toast toast-success">
  <i class="icon-check-circle"></i>
  <span>操作成功</span>
  <button class="toast-close">
    <i class="icon-x"></i>
  </button>
</div>

<div class="toast toast-error">
  <i class="icon-x-circle"></i>
  <span>操作失败，请重试</span>
</div>

<div class="toast toast-warning">
  <i class="icon-alert-circle"></i>
  <span>请注意潜在问题</span>
</div>

<div class="toast toast-info">
  <i class="icon-info"></i>
  <span>提示信息</span>
</div>
```

```css
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 400px;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-success {
  border-left: 4px solid var(--accent-success);
}

.toast-error {
  border-left: 4px solid var(--accent-error);
}

.toast-warning {
  border-left: 4px solid var(--accent-warning);
}

.toast-info {
  border-left: 4px solid var(--accent-info);
}

.toast-close {
  margin-left: auto;
  padding: var(--space-1);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}
```

**对话框（Modal）**

```html
<div class="modal-overlay">
  <div class="modal">
    <div class="modal-header">
      <h2 class="modal-title">对话框标题</h2>
      <button class="modal-close">
        <i class="icon-x"></i>
      </button>
    </div>

    <div class="modal-body">
      对话框内容...
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary">取消</button>
      <button class="btn btn-primary">确认</button>
    </div>
  </div>
</div>
```

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: var(--space-4);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  width: 100%;
  max-width: 600px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: scaleIn 0.2s ease;
}

@keyframes scaleIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  padding: var(--space-1);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-5);
  max-height: 60vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
}
```

### 4.4 加载组件

**Spinner**

```html
<div class="spinner"></div>

<div class="spinner spinner-lg"></div>

<div class="spinner spinner-sm"></div>
```

```css
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-default);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.spinner-lg {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**骨架屏**

```html
<div class="skeleton-card">
  <div class="skeleton-header">
    <div class="skeleton-avatar"></div>
    <div class="skeleton-info">
      <div class="skeleton-title"></div>
      <div class="skeleton-text"></div>
    </div>
  </div>
  <div class="skeleton-body">
    <div class="skeleton-line"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
  </div>
</div>
```

```css
.skeleton-card {
  padding: var(--space-4);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.skeleton-header {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
}

.skeleton-info {
  flex: 1;
}

.skeleton-title {
  height: 20px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-text {
  height: 14px;
  width: 60%;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  animation: pulse 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}

.skeleton-line {
  height: 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-line.short {
  width: 40%;
  animation-delay: 0.4s;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

---

## 5. 响应式设计

### 5.1 断点系统

```css
/* 断点定义 */
--breakpoint-sm: 640px;   /* 手机横屏 */
--breakpoint-md: 768px;   /* 平板竖屏 */
--breakpoint-lg: 1024px;  /* 平板横屏/小笔记本 */
--breakpoint-xl: 1280px;  /* 桌面 */
--breakpoint-2xl: 1536px; /* 大屏幕 */
```

### 5.2 移动端适配

**导航适配**

```css
/* 桌面端导航 */
@media (min-width: 1024px) {
  .nav-menu {
    display: flex;
    gap: var(--space-6);
  }

  .mobile-nav {
    display: none;
  }
}

/* 移动端导航 */
@media (max-width: 1023px) {
  .nav-menu {
    display: none;
  }

  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border-top: 1px solid var(--border-default);
    padding: var(--space-2) var(--space-4);
    justify-content: space-around;
    z-index: 100;
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-decoration: none;
  }

  .mobile-nav-item.active {
    color: var(--accent-primary);
  }

  .mobile-nav-icon {
    font-size: 24px;
  }
}
```

**网格布局适配**

```css
/* 文档卡片网格 */
.document-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

/* 平板: 2 列 */
@media (min-width: 768px) and (max-width: 1023px) {
  .document-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 手机: 1 列 */
@media (max-width: 767px) {
  .document-grid {
    grid-template-columns: 1fr;
  }
}
```

**搜索框适配**

```css
.search-container {
  max-width: 800px;
  margin: 0 auto;
}

@media (max-width: 767px) {
  .search-container {
    padding: 0 var(--space-4);
  }

  .search-box {
    flex-direction: column;
    gap: var(--space-2);
  }

  .search-input {
    font-size: var(--text-base);
  }
}
```

### 5.3 触摸优化

```css
/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  /* 增大可点击区域 */
  .btn {
    min-height: 44px;
    min-width: 44px;
  }

  .btn-icon {
    width: 44px;
    height: 44px;
  }

  /* 移除悬停效果 */
  .btn:hover,
  .document-card:hover {
    transform: none;
  }

  /* 添加触摸反馈 */
  .btn:active {
    opacity: 0.7;
  }
}
```

### 5.4 横屏适配

```css
/* 横屏模式优化 */
@media (orientation: landscape) and (max-height: 600px) {
  .header {
    padding: var(--space-2) var(--space-4);
  }

  .main-content {
    padding: var(--space-2) var(--space-4);
  }

  .modal {
    max-height: 90vh;
  }

  .modal-body {
    max-height: 50vh;
  }
}
```

---

## 6. 交互规范

### 6.1 加载状态

**初始加载**

```javascript
// 页面加载时显示骨架屏
function showSkeleton() {
  document.querySelector('.content').innerHTML = `
    <div class="skeleton-list">
      ${Array(5).fill('<div class="skeleton-item"></div>').join('')}
    </div>
  `;
}

// 数据加载完成后替换为实际内容
function hideSkeleton(data) {
  document.querySelector('.content').innerHTML = renderContent(data);
}
```

**按钮加载状态**

```javascript
// 按钮点击后显示加载状态
function handleButtonClick(button) {
  button.classList.add('loading');
  button.disabled = true;

  // 模拟 API 调用
  setTimeout(() => {
    button.classList.remove('loading');
    button.disabled = false;
  }, 2000);
}
```

**分页加载**

```javascript
// 滚动到底部时自动加载更多
let isLoading = false;
let hasMore = true;

window.addEventListener('scroll', () => {
  if (isLoading || !hasMore) return;

  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    loadMore();
  }
});

async function loadMore() {
  isLoading = true;
  showLoadingSpinner();

  const data = await fetchMoreData();

  if (data.length === 0) {
    hasMore = false;
    showEndMessage();
  } else {
    appendContent(data);
  }

  hideLoadingSpinner();
  isLoading = false;
}
```

### 6.2 错误处理

**API 错误**

```javascript
async function handleAPIRequest() {
  try {
    const response = await fetch('/api/documents');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }

    return data;
  } catch (error) {
    showErrorToast(error.message);
    console.error('API Error:', error);
    throw error;
  }
}

function showErrorToast(message) {
  showToast({
    type: 'error',
    message: message || '操作失败，请重试',
    duration: 5000
  });
}
```

**表单验证**

```javascript
function validateForm(formData) {
  const errors = {};

  // 必填字段验证
  if (!formData.title) {
    errors.title = '请输入标题';
  }

  // URL 格式验证
  if (formData.url && !isValidURL(formData.url)) {
    errors.url = '请输入有效的 URL';
  }

  // 长度验证
  if (formData.description && formData.description.length > 500) {
    errors.description = '描述不能超过 500 字符';
  }

  return errors;
}

function showFormErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = document.querySelector(`[name="${field}"]`);
    const errorElement = input.parentElement.querySelector('.form-error');

    input.classList.add('input-error');
    errorElement.textContent = message;
  });
}
```

**网络错误重试**

```javascript
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 6.3 用户反馈

**操作确认**

```javascript
function confirmAction(message, callback) {
  const confirmed = window.confirm(message);
  if (confirmed) {
    callback();
  }
}

// 使用示例
confirmAction('确定要删除这个文档吗？此操作不可撤销。', async () => {
  await deleteDocument(documentId);
  showToast('文档已删除');
});
```

**成功提示**

```javascript
function showToast({ type = 'info', message, duration = 3000 }) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="icon-${getIconForType(type)}"></i>
    <span>${message}</span>
    <button class="toast-close">
      <i class="icon-x"></i>
    </button>
  `;

  document.querySelector('.toast-container').appendChild(toast);

  // 自动关闭
  setTimeout(() => {
    toast.remove();
  }, duration);

  // 手动关闭
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });
}
```

**进度反馈**

```javascript
// 长时间操作进度显示
function uploadProgress(file) {
  const progress = document.createElement('div');
  progress.className = 'upload-progress';
  progress.innerHTML = `
    <div class="progress-header">
      <span>上传中: ${file.name}</span>
      <span class="progress-percent">0%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
  `;

  document.querySelector('.upload-list').appendChild(progress);

  // 模拟上传进度
  let percent = 0;
  const interval = setInterval(() => {
    percent += 10;
    progress.querySelector('.progress-percent').textContent = `${percent}%`;
    progress.querySelector('.progress-fill').style.width = `${percent}%`;

    if (percent >= 100) {
      clearInterval(interval);
      progress.remove();
      showToast('上传成功');
    }
  }, 500);
}
```

### 6.4 快捷键支持

```javascript
// 全局快捷键
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K: 搜索
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    focusSearchInput();
  }

  // Esc: 关闭对话框
  if (e.key === 'Escape') {
    closeModal();
  }

  // Ctrl/Cmd + /: 显示快捷键帮助
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    showKeyboardShortcuts();
  }
});

// 在搜索框中
document.querySelector('.search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }

  // 上下箭头导航搜索结果
  if (e.key === 'ArrowDown') {
    navigateResults('down');
  }
  if (e.key === 'ArrowUp') {
    navigateResults('up');
  }
});
```

---

## 7. 无障碍设计

### 7.1 语义化 HTML

```html
<!-- 正确的标题层级 -->
<header>
  <h1>devrag-cli</h1>
  <nav aria-label="主导航">
    <ul>
      <li><a href="#/documents" aria-current="page">文档库</a></li>
      <li><a href="#/search">搜索</a></li>
      <li><a href="#/crawler">爬虫</a></li>
      <li><a href="#/system">系统</a></li>
    </ul>
  </nav>
</header>

<main>
  <h2>文档列表</h2>
  <article class="document-card">
    <h3>React Hooks 完全指南</h3>
    <p>文档描述...</p>
  </article>
</main>

<footer>
  <p>&copy; 2026 devrag-cli</p>
</footer>
```

### 7.2 ARIA 属性

```html
<!-- 按钮状态 -->
<button
  aria-label="删除文档"
  aria-pressed="false"
  class="btn-icon"
>
  <i class="icon-trash" aria-hidden="true"></i>
</button>

<!-- 加载状态 -->
<div
  role="status"
  aria-live="polite"
  aria-busy="true"
  class="loading-spinner"
>
  <span class="sr-only">加载中...</span>
</div>

<!-- 对话框 -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
  class="modal-overlay"
>
  <div class="modal">
    <h2 id="dialog-title">导入文档</h2>
    <p id="dialog-description">选择要导入的文档类型</p>
    <!-- 对话框内容 -->
  </div>
</div>

<!-- 表单关联 -->
<label for="search-input" class="sr-only">搜索文档</label>
<input
  type="text"
  id="search-input"
  aria-label="搜索文档"
  aria-describedby="search-hint"
  placeholder="请输入您的问题..."
/>
<span id="search-hint" class="sr-only">
  输入问题后按 Enter 搜索
</span>
```

### 7.3 键盘导航

```javascript
// 确保所有交互元素可键盘访问
document.querySelectorAll('.interactive-element').forEach(element => {
  // 设置 tabindex
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '0');
  }

  // 添加键盘事件
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      element.click();
    }
  });
});

// 焦点陷阱（对话框中）
function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  });
}
```

### 7.4 屏幕阅读器支持

```css
/* 仅屏幕阅读器可见的内容 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* 焦点时可见（键盘导航） */
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}

/* 隐藏装饰性图标 */
.icon {
  @extend .sr-only;
}

/* 但如果有纯图标按钮，保持可见 */
.btn-icon .icon {
  position: static;
  width: auto;
  height: auto;
}
```

```html
<!-- 图标 + 文本 -->
<button>
  <i class="icon-search" aria-hidden="true"></i>
  <span>搜索</span>
</button>

<!-- 纯图标按钮（需要 aria-label） -->
<button aria-label="搜索">
  <i class="icon-search" aria-hidden="true"></i>
</button>

<!-- 状态变化通知 -->
<div
  role="status"
  aria-live="polite"
  class="sr-only"
  id="live-region"
></div>

<script>
// 动态更新状态
function announceStatus(message) {
  const liveRegion = document.getElementById('live-region');
  liveRegion.textContent = message;
}

// 使用示例
announceStatus('文档导入完成，共导入 5 个文件');
</script>
```

---

## 8. 性能优化策略

### 8.1 资源优化

**图标优化**

```html
<!-- 使用 SVG Sprite 减少请求 -->
<svg style="display: none;">
  <symbol id="icon-search" viewBox="0 0 24 24">
    <path d="..."/>
  </symbol>
  <symbol id="icon-folder" viewBox="0 0 24 24">
    <path d="..."/>
  </symbol>
</svg>

<!-- 使用时引用 -->
<svg class="icon">
  <use href="#icon-search"></use>
</svg>
```

**字体优化**

```css
/* 字体加载策略 */
@font-face {
  font-family: 'Custom Font';
  src: url('/fonts/font.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap; /* 快速显示文本 */
}

/* 系统字体栈（无需加载） */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
               "Noto Sans", Helvetica, Arial, sans-serif;
}
```

**图片优化**

```html
<!-- 响应式图片 -->
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w,
          image-800.jpg 800w,
          image-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px,
         (max-width: 1200px) 800px,
         1200px"
  alt="描述性文本"
  loading="lazy"
/>

<!-- 懒加载 -->
<img
  src="placeholder.jpg"
  data-src="actual-image.jpg"
  alt="描述性文本"
  loading="lazy"
/>
```

### 8.2 渲染优化

**虚拟滚动**

```javascript
// 大列表虚拟滚动
class VirtualScroll {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.visibleItems = Math.ceil(container.clientHeight / itemHeight);
    this.startIndex = 0;
    this.endIndex = this.visibleItems;

    container.addEventListener('scroll', () => this.onScroll());
  }

  onScroll() {
    const scrollTop = this.container.scrollTop;
    this.startIndex = Math.floor(scrollTop / this.itemHeight);
    this.endIndex = this.startIndex + this.visibleItems;
    this.render();
  }

  render() {
    const fragment = document.createDocumentFragment();

    for (let i = this.startIndex; i < this.endIndex; i++) {
      const item = this.renderItem(i);
      item.style.position = 'absolute';
      item.style.top = `${i * this.itemHeight}px`;
      fragment.appendChild(item);
    }

    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}
```

**防抖和节流**

```javascript
// 防抖（搜索输入）
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 使用
const searchInput = document.querySelector('.search-input');
searchInput.addEventListener('input', debounce((e) => {
  performSearch(e.target.value);
}, 300));

// 节流（滚动事件）
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 使用
window.addEventListener('scroll', throttle(() => {
  handleScroll();
}, 100));
```

### 8.3 网络优化

**API 请求优化**

```javascript
// 请求合并
class RequestBatcher {
  constructor(delay = 100) {
    this.delay = delay;
    this.requests = [];
    this.timeout = null;
  }

  add(request) {
    return new Promise((resolve, reject) => {
      this.requests.push({ request, resolve, reject });

      if (!this.timeout) {
        this.timeout = setTimeout(() => {
          this.flush();
        }, this.delay);
      }
    });
  }

  async flush() {
    const requests = this.requests.splice(0);
    this.timeout = null;

    try {
      // 批量请求
      const response = await fetch('/api/batch', {
        method: 'POST',
        body: JSON.stringify(requests.map(r => r.request))
      });

      const results = await response.json();

      // 分发结果
      requests.forEach((req, index) => {
        req.resolve(results[index]);
      });
    } catch (error) {
      requests.forEach(req => req.reject(error));
    }
  }
}

// 使用
const batcher = new RequestBatcher();
batcher.add({ type: 'get', id: 1 }).then(result => {
  console.log(result);
});
```

**缓存策略**

```javascript
// 简单的内存缓存
class Cache {
  constructor(ttl = 5 * 60 * 1000) { // 5 分钟
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  has(key) {
    return this.get(key) !== null;
  }
}

// 使用
const cache = new Cache();

async function fetchWithCache(url) {
  if (cache.has(url)) {
    return cache.get(url);
  }

  const response = await fetch(url);
  const data = await response.json();
  cache.set(url, data);
  return data;
}
```

### 8.4 监控和分析

**性能监控**

```javascript
// 页面加载性能
window.addEventListener('load', () => {
  const perfData = performance.getEntriesByType('navigation')[0];

  console.log('页面加载性能:', {
    DNS查询: perfData.domainLookupEnd - perfData.domainLookupStart,
    TCP连接: perfData.connectEnd - perfData.connectStart,
    请求响应: perfData.responseEnd - perfData.requestStart,
    DOM解析: perfData.domComplete - perfData.domInteractive,
    完全加载: perfData.loadEventEnd - perfData.loadEventStart
  });
});

// API 请求性能
async function fetchWithTiming(url, options = {}) {
  const startTime = performance.now();

  try {
    const response = await fetch(url, options);
    const endTime = performance.now();

    console.log(`API 请求耗时: ${(endTime - startTime).toFixed(2)}ms`, {
      url,
      status: response.status,
      duration: endTime - startTime
    });

    return response;
  } catch (error) {
    const endTime = performance.now();
    console.error(`API 请求失败 (${(endTime - startTime).toFixed(2)}ms):`, error);
    throw error;
  }
}
```

**错误监控**

```javascript
// 全局错误捕获
window.addEventListener('error', (event) => {
  console.error('全局错误:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });

  // 发送到日志服务
  sendToLogService({
    type: 'error',
    message: event.message,
    stack: event.error?.stack
  });
});

// Promise 错误捕获
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);

  sendToLogService({
    type: 'unhandledRejection',
    reason: event.reason
  });
});
```

---

## 9. 实现技术栈

### 9.1 前端技术

**HTML/CSS/JS**
- 纯静态文件，无需构建步骤
- 使用 CSS 变量实现主题系统
- 原生 JavaScript（ES6+）
- 可选：Alpine.js（轻量级响应式框架）

**UI 库选择**

```html
<!-- Tailwind CSS（CDN） -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- 或使用自定义 CSS -->
<style>
  /* 使用本文档定义的 CSS 变量和组件 */
</style>
```

**图标库**

```html
<!-- Lucide Icons（推荐） -->
<script src="https://unpkg.com/lucide@latest"></script>
<script>
  lucide.createIcons();
</script>

<!-- 或使用 SVG Sprite -->
```

### 9.2 与后端集成

**API 通信**

```javascript
// API 基础配置
const API_BASE = '/api';

// 请求封装
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// API 方法
export const API = {
  // 文档管理
  getDocuments: () => apiRequest('/documents'),
  getDocument: (id) => apiRequest(`/documents/${id}`),
  createDocument: (data) => apiRequest('/documents', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteDocument: (id) => apiRequest(`/documents/${id}`, {
    method: 'DELETE'
  }),

  // 搜索
  search: (query, options = {}) => apiRequest('/search', {
    method: 'POST',
    body: JSON.stringify({ query, ...options })
  }),

  // 爬虫
  getCrawlerTasks: () => apiRequest('/crawler/tasks'),
  createCrawlerTask: (data) => apiRequest('/crawler/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // 系统状态
  getSystemStatus: () => apiRequest('/system/status')
};
```

**WebSocket 连接**

```javascript
// 实时状态更新
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket 已连接');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket 已断开');
      this.reconnect();
    };
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      setTimeout(() => {
        console.log(`WebSocket 重连中 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  handleMessage(data) {
    // 处理不同类型的消息
    switch (data.type) {
      case 'status_update':
        updateSystemStatus(data.payload);
        break;
      case 'task_progress':
        updateTaskProgress(data.payload);
        break;
      case 'notification':
        showToast(data.payload);
        break;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用
const ws = new WebSocketClient('ws://localhost:3000/ws');
ws.connect();
```

### 9.3 开发工具

**代码格式化**

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

**代码检查**

```json
// .eslintrc.json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error"
  }
}
```

---

## 10. 设计交付物

### 10.1 设计文件

**设计稿**
- Figma/Sketch 设计文件
- 包含所有页面和组件
- 标注尺寸、间距、颜色

**图标资源**
- SVG 格式图标
- 图标 Sprite 文件
- 图标使用指南

**原型**
- 交互原型（可选）
- 用户流程图

### 10.2 开发资源

**样式库**
```css
/* styles.css - 完整样式文件 */
:root {
  /* CSS 变量 */
  --bg-primary: #0d1117;
  --text-primary: #c9d1d9;
  --accent-primary: #58a6ff;
  /* ... 其他变量 */
}

/* 基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family-base);
  color: var(--text-primary);
  background: var(--bg-primary);
}

/* 组件样式 */
.btn {
  /* ... */
}

/* 工具类 */
.sr-only {
  /* ... */
}
```

**组件模板**
```html
<!-- templates/components/button.html -->
<button class="btn btn-{{ variant }}" {{ attributes }}>
  {{ content }}
</button>

<!-- templates/components/card.html -->
<div class="card">
  {{ content }}
</div>
```

**JavaScript 工具**
```javascript
// utils/dom.js
export function $(selector) {
  return document.querySelector(selector);
}

export function createElement(tag, classes = [], attributes = {}) {
  const element = document.createElement(tag);
  element.classList.add(...classes);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

// utils/api.js
export async function fetchJSON(url, options = {}) {
  // ...
}

// utils/events.js
export function on(element, event, handler) {
  element.addEventListener(event, handler);
}

export function off(element, event, handler) {
  element.removeEventListener(event, handler);
}
```

### 10.3 文档

**组件文档**
```markdown
# Button 组件

## 用途
用于触发操作的按钮。

## 变体
- `btn-primary`: 主要操作
- `btn-secondary`: 次要操作
- `btn-danger`: 危险操作
- `btn-icon`: 图标按钮
- `btn-text`: 文本按钮

## 示例
\`\`\`html
<button class="btn btn-primary">
  确认
</button>
\`\`\`

## 可访问性
- 按钮应有明确的文本或 aria-label
- 支持键盘导航
```

**设计指南**
- 颜色使用指南
- 排版指南
- 间距使用指南
- 图标使用指南

---

## 11. 设计评审清单

### 11.1 视觉设计

- [ ] 颜色对比度符合 WCAG AA 标准（4.5:1）
- [ ] 字体大小可读（正文 ≥ 14px）
- [ ] 间距一致（遵循 4px 网格）
- [ ] 圆角统一（4px/6px/8px）
- [ ] 阴影使用适度

### 11.2 交互设计

- [ ] 所有交互元素有悬停状态
- [ ] 所有交互元素有焦点状态
- [ ] 加载状态清晰可见
- [ ] 错误状态友好明确
- [ ] 成功操作有反馈

### 11.3 响应式设计

- [ ] 在手机（375px）上正常显示
- [ ] 在平板（768px）上正常显示
- [ ] 在桌面（1280px）上正常显示
- [ ] 横屏模式适配
- [ ] 触摸目标足够大（≥ 44px）

### 11.4 性能

- [ ] 首屏加载 < 1 秒
- [ ] 页面交互响应 < 100ms
- [ ] 图片懒加载
- [ ] 无阻塞渲染
- [ ] 资源大小优化

### 11.5 可访问性

- [ ] 键盘可导航所有功能
- [ ] 屏幕阅读器友好
- [ ] ARIA 属性正确
- [ ] 焦点管理正确
- [ ] 错误消息清晰

### 11.6 浏览器兼容性

- [ ] Chrome 90+ 正常
- [ ] Firefox 88+ 正常
- [ ] Safari 14+ 正常
- [ ] Edge 90+ 正常
- [ ] 移动浏览器正常

---

## 12. 附录

### 12.1 颜色参考

**主色调**
- 主背景: `#0d1117` (GitHub Dark Dimmed)
- 次级背景: `#161b22`
- 三级背景: `#21262d`
- 边框: `#30363d`

**文本色**
- 主文本: `#c9d1d9`
- 次级文本: `#8b949e`
- 弱化文本: `#6e7681`

**功能色**
- 主强调: `#58a6ff`
- 成功: `#3fb950`
- 警告: `#d29922`
- 错误: `#f85149`
- 信息: `#a5d6ff`

### 12.2 字体参考

**系统字体栈**
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
             "Noto Sans", Helvetica, Arial, sans-serif,
             "Apple Color Emoji", "Segoe UI Emoji";
```

**等宽字体栈**
```css
font-family: ui-monospace, SFMono-Regular, "SF Mono",
             Menlo, Consolas, "Liberation Mono", monospace;
```

### 12.3 图标参考

**推荐图标库**
- Lucide Icons: https://lucide.dev/
- Heroicons: https://heroicons.com/
- Feather Icons: https://feathericons.com/

### 12.4 参考资源

**设计灵感**
- GitHub Dark Theme
- VS Code Dark Theme
- Linear Design System
- Shadcn UI

**开发资源**
- MDN Web Docs
- CSS Tricks
- A11y Project
- Web.dev

---

**文档结束**

**版本历史**

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-03-26 | 初始版本，完整 UI 设计规范 | UI Designer |
