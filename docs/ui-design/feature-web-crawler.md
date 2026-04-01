# Web Crawler UI 设计

| 文档版本 | 日期 | 作者 | 变更说明 |
|---------|------|------|---------|
| v1.0 | 2026-04-01 | UI Designer | 初始版本 |

---

## 1. 设计原则

### 1.1 设计语言

- **简洁高效**：保持界面简洁，突出核心功能，减少用户认知负担
- **一致性**：与项目现有 Naive UI 风格保持一致，复用组件和设计模式
- **渐进式披露**：简单场景快速完成，复杂场景按需展开高级选项
- **即时反馈**：所有操作提供清晰的状态反馈和进度提示

### 1.2 视觉风格

**色彩系统**
- 主色调：`#18a058`（Naive UI Primary Green）- 主要操作按钮
- 辅助色：`#2080f0`（Info Blue）- 信息提示、链接
- 成功色：`#18a058`（Success Green）- 成功状态
- 警告色：`#f0a020`（Warning Orange）- 警告提示
- 错误色：`#d03050`（Error Red）- 错误状态
- 中性色：`#2080f0`、`#606266`、`#909399` - 文本和边框

**字体规范**
- 标题：`20px / 18px / 16px`（H1/H2/H3）
- 正文：`14px`（默认）
- 辅助文本：`12px`（次要信息）
- 行高：`1.5`（正文）、`1.2`（标题）

**间距规范**
- 页面边距：`24px`
- 组件间距：`16px`（large）、`12px`（medium）、`8px`（small）
- 内边距：`16px`（卡片）、`12px`（表单项）

**圆角和阴影**
- 圆角：`4px`（按钮）、`8px`（卡片）、`12px`（弹窗）
- 阴影：`0 2px 8px rgba(0, 0, 0, 0.1)`（卡片）、`0 4px 16px rgba(0, 0, 0, 0.15)`（弹窗）

---

## 2. 页面结构

### 2.1 页面清单

| 页面名称 | 路由 | 描述 |
|---------|------|------|
| Web Crawler 主页 | `/crawler` | 爬取功能入口，包含三种爬取模式 |
| 爬取历史 | `/crawler/history` | 爬取任务历史记录列表 |
| 认证管理 | `/crawler/auth` | 认证配置管理（可集成在主页） |

### 2.2 导航结构

**主导航**
- 侧边栏菜单新增"Web Crawler"入口（图标：`globe-outline`）
- Dashboard 快捷操作区新增"Import from Web"按钮

**页面内导航**
- Tab 切换：单页面爬取 / 站点地图爬取 / 递归爬取
- 面包屑：Web Crawler > [当前模式]

---

## 3. 核心页面设计

### 3.1 Web Crawler 主页面

#### 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  <n-h1> Web Crawler </n-h1>                                  │
├─────────────────────────────────────────────────────────────┤
│  <n-tabs type="line" animated>                               │
│    ┌───────────────────────────────────────────────────────┐│
│    │ [单页面爬取] [站点地图] [递归爬取]                     ││
│    └───────────────────────────────────────────────────────┘│
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Tab Content Area                                      │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │ URL Input Section                               │  │ │
│  │  │ <n-input url placeholder="https://...">         │  │ │
│  │  │ <n-button type="primary">Crawl</n-button>        │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │ Auth Configuration (Collapsible)                │  │ │
│  │  │ <n-collapse>                                    │  │ │
│  │  │   认证配置 ▼                                     │  │ │
│  │  │   - Cookie 注入 / Header 注入 / 浏览器登录      │  │ │
│  │  │ </n-collapse>                                   │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │ Progress / Preview Section (Dynamic)            │  │ │
│  │  │ - Single: Content Preview                       │  │ │
│  │  │ - Sitemap: URL List + Progress                  │  │ │
│  │  │ - Recursive: Discovered URLs                    │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 组件清单

**单页面爬取 Tab**
- `UrlInput`：URL 输入框（带验证）
- `AuthConfigCollapse`：认证配置折叠面板
- `CrawlButton`：爬取按钮（带加载状态）
- `ContentPreview`：内容预览组件
- `ImportConfirm`：导入确认弹窗

**站点地图爬取 Tab**
- `SitemapUrlInput`：Sitemap URL 输入
- `SitemapParser`：解析按钮和结果展示
- `UrlSelector`：URL 列表选择器（支持全选/反选）
- `BatchCrawlProgress`：批量爬取进度组件
- `BatchImportConfirm`：批量导入确认界面

**递归爬取 Tab**
- `StartUrlInput`：起始 URL 输入
- `DepthSelector`：递归深度选择（1-3）
- `UrlFilterInput`：URL 过滤规则配置
- `LinkDiscoveryProgress`：链接发现进度
- `DiscoveredUrlsList`：发现的 URL 列表

#### 交互说明

**单页面爬取流程**
1. 用户输入 URL → 实时验证格式（绿色✓ / 红色✗）
2. 点击"Crawl"按钮 → 按钮显示加载动画（`<n-spin>`）
3. 爬取完成 → 显示内容预览卡片
4. 用户编辑标题/添加标签
5. 点击"Import" → 显示导入成功提示（`<n-message type="success">`）

**站点地图爬取流程**
1. 输入 Sitemap URL → 点击"Parse Sitemap"
2. 显示解析结果（总 URL 数、预计耗时）
3. 显示 URL 列表（虚拟滚动，支持搜索）
4. 用户勾选 URL → 点击"Start Crawl"（或"Select All"）
5. 显示进度条（`<n-progress>`）+ 当前 URL
6. 爬取完成 → 进入批量导入确认界面

**批量导入确认流程**
1. 显示爬取结果列表（DataTable）
2. 列表字段：选择框 | 标题 | 字数 | 质量评分 | 来源 | 状态
3. 默认全选，已导入 URL 灰色标记
4. 批量设置标签（`<n-dynamic-tags>`）
5. 点击"Import N pages" → 显示导入进度
6. 完成后显示汇总（成功 X、失败 Y、跳过 Z）

---

### 3.2 爬取历史页面

#### 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  <n-h1> Crawl History </n-h1>                                │
│  <n-space>                                                   │
│    <n-select placeholder="Filter by status" />              │
│    <n-input placeholder="Search URL or title" />            │
│    <n-button @click="refresh">Refresh</n-button>             │
│  </n-space>                                                  │
│                                                              │
│  <n-data-table                                              │
│    :columns="columns"                                       │
│    :data="tasks"                                            │
│    :loading="loading"                                       │
│    :pagination="{ pageSize: 20 }"                           │
│  />                                                          │
└─────────────────────────────────────────────────────────────┘
```

#### 列表字段

| 字段 | 描述 | 渲染 |
|------|------|------|
| Task ID | 任务标识 | 单击展开详情 |
| Mode | 爬取模式 | `<n-tag>`：Single/Sitemap/Recursive |
| URLs | URL 数量 | 数字 + 总数 |
| Status | 任务状态 | `<n-tag type="success/warning/error">` |
| Progress | 进度 | 进度条 + X/Y |
| Created | 创建时间 | 格式化日期 |
| Actions | 操作 | 重试 / 删除 / 查看结果 |

---

### 3.3 认证管理（集成在主页）

#### 布局结构（折叠面板）

```
┌─────────────────────────────────────────────────────────────┐
│  <n-collapse>                                               │
│    <n-collapse-item title="认证配置" name="auth">           │
│      <n-tabs type="segment">                                │
│        <n-tab-pane name="cookie" tab="Cookie 注入">         │
│          <n-form>                                           │
│            <n-form-item label="域名">                       │
│              <n-input v-model:value="domain"                │
│                placeholder="example.com" />                 │
│            </n-form-item>                                   │
│            <n-form-item label="Cookie">                     │
│              <n-input type="textarea"                       │
│                placeholder="key1=value1; key2=value2"       │
│                :rows="5" />                                 │
│            </n-form-item>                                   │
│            <n-form-item label="别名（可选）">               │
│              <n-input placeholder="如：公司 GitLab" />      │
│            </n-form-item>                                   │
│          </n-form>                                          │
│          <n-button type="primary">保存</n-button>           │
│        </n-tab-pane>                                        │
│                                                             │
│        <n-tab-pane name="header" tab="Header 注入">         │
│          <n-form>                                           │
│            <n-form-item label="域名">                       │
│              <n-input v-model:value="domain" />             │
│            </n-form-item>                                   │
│            <n-form-item label="Header Name">                │
│              <n-input placeholder="Authorization" />        │
│            </n-form-item>                                   │
│            <n-form-item label="Header Value">               │
│              <n-input placeholder="Bearer xxx" />           │
│            </n-form-item>                                   │
│          </n-form>                                          │
│          <n-button type="primary">保存</n-button>           │
│        </n-tab-pane>                                        │
│                                                             │
│        <n-tab-pane name="browser" tab="浏览器登录">         │
│          <n-alert type="info" title="浏览器登录模式">       │
│            适用于需要手动登录的场景（如验证码、2FA）。       │
│            完成登录后，请点击下方按钮提取认证信息。         │
│          </n-alert>                                          │
│          <n-form>                                           │
│            <n-form-item label="登录页 URL">                 │
│              <n-input                                       │
│                placeholder="https://github.com/login"      │
│              />                                             │
│            </n-form-item>                                   │
│            <n-form-item label="别名（可选）">               │
│              <n-input placeholder="如：个人 GitHub" />      │
│            </n-form-item>                                   │
│          </n-form>                                          │
│          <n-button type="primary"                           │
│            :loading="browserLaunching"                     │
│            @click="launchBrowser"                           │
│          >                                                   │
│            启动浏览器                                        │
│          </n-button>                                         │
│                                                             │
│          <!-- SSE 状态监听 -->                              │
│          <n-card v-if="browserLoginStatus === 'launched'"   │
│            title="浏览器运行状态"                            │
│            :bordered="false">                               │
│            <n-space vertical>                               │
│              <n-alert type="success">                       │
│                <template #header>                          │
│                  <n-space align="center">                  │
│                    <n-icon :component="CheckIcon" />       │
│                    <span>浏览器已启动</span>               │
│                  </n-space>                                │
│                </template>                                   │
│                请在打开的浏览器窗口中完成登录操作。          │
│                完成后请点击下方按钮提取认证信息。            │
│              </n-alert>                                     │
│              <n-alert type="warning">                       │
│                <template #header>                          │
│                  <n-space align="center">                  │
│                    <n-icon :component="WarningIcon" />     │
│                    <span>请手动确认登录状态</span>          │
│                  </n-space>                                │
│                </template>                                   │
│                系统不会自动检测登录是否成功。                │
│                请确认您已在浏览器中成功登录后，              │
│                再点击下方按钮。                              │
│              </n-alert>                                     │
│              <n-divider />                                  │
│              <n-button type="primary" size="large"          │
│                @click="extractCookies"                     │
│              >                                               │
│                我已完成登录，提取认证信息                    │
│              </n-button>                                    │
│              <n-button @click="cancelBrowserLogin">         │
│                取消                                          │
│              </n-button>                                    │
│            </n-space>                                       │
│          </n-card>                                           │
│                                                             │
│          <!-- 浏览器已关闭 -->                              │
│          <n-result v-if="browserLoginStatus === 'closed'"  │
│            status="warning"                                 │
│            title="浏览器已关闭"                              │
│            description="浏览器窗口已被关闭，请重新启动"      │
│          >                                                   │
│            <template #footer>                                │
│              <n-button type="primary" @click="launchBrowser">│
│                重新启动                                      │
│              </n-button>                                    │
│            </template>                                       │
│          </n-result>                                         │
│        </n-tab-pane>                                        │
│      </n-tabs>                                              │
│                                                             │
│      <n-divider />                                          │
│      <n-text>已保存的认证配置</n-text>                       │
│      <n-list>                                               │
│        <n-list-item v-for="profile in authProfiles">        │
│          <n-space>                                          │
│            <n-tag>{{ profile.type }}</n-tag>                │
│            <n-text>{{ profile.domain }}</n-text>            │
│            <n-text depth="3">{{ profile.name }}</n-text>    │
│            <n-button size="small" type="error"              │
│              @click="deleteProfile(profile.id)">删除        │
│            </n-button>                                       │
│          </n-space>                                         │
│        </n-list-item>                                       │
│      </n-list>                                              │
│    </n-collapse-item>                                       │
│  </n-collapse>                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 组件设计

### 4.1 按钮

#### 样式规范

| 类型 | 用途 | 样式 | 示例 |
|------|------|------|------|
| Primary | 主要操作 | `type="primary"` | Crawl、Import、Save |
| Default | 次要操作 | 默认 | Cancel、Back |
| Info | 信息操作 | `type="info"` | View Details |
| Success | 成功状态 | `type="success"` | Retry Success |
| Warning | 警告操作 | `type="warning"` | Skip |
| Error | 危险操作 | `type="error"` | Delete、Terminate |

#### 状态规范

| 状态 | 描述 | 表现 |
|------|------|------|
| 默认 | 可交互 | 正常颜色，鼠标悬停时背景变深 |
| 悬停 | 鼠标悬停 | 背景色加深 10%，显示提示（如有） |
| 点击 | 正在点击 | 背景色加深 20%，轻微缩放（0.98） |
| 禁用 | 不可用 | `disabled` 属性，透明度 0.5，鼠标变禁用光标 |
| 加载中 | 请求中 | `:loading="true"`，显示 `<n-spin>` 替代文本 |

#### 尺寸规范

| 尺寸 | 高度 | 字号 | 用途 |
|------|------|------|------|
| small | 24px | 12px | 表格内操作按钮 |
| medium | 32px | 14px | 默认按钮 |
| large | 40px | 16px | 主要操作按钮 |

---

### 4.2 表单

#### 布局规范

**表单结构**
```vue
<n-form
  ref="formRef"
  :model="formValue"
  :rules="rules"
  label-placement="left"
  label-width="auto"
  require-mark-placement="right"
>
  <n-form-item label="URL" path="url">
    <n-input v-model:value="formValue.url" placeholder="https://..." />
  </n-form-item>
</n-form>
```

**表单项间距**
- 垂直间距：`16px`
- 标签宽度：`auto`（自适应）/ `120px`（固定）
- 标签对齐：`left`（左对齐）

#### 验证规则

**实时验证**
- URL 格式：失焦时验证（`trigger="blur"`）
- 必填项：实时验证（`trigger="input"`）
- 提交时：全局验证

**错误提示**
- 显示位置：表单项下方
- 样式：红色文字，`<n-form-item :feedback="error">`
- 图标：`<template #feedback><n-icon color="error" /></template>`

**示例**
```typescript
const rules = {
  url: {
    required: true,
    message: '请输入 URL',
    trigger: ['input', 'blur']
  },
  urlFormat: {
    validator: (rule: FormItemRule, value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return new Error('URL 格式无效');
      }
    },
    trigger: ['input', 'blur']
  }
};
```

---

### 4.3 列表/表格

#### 排序和筛选

**表格配置**
```vue
<n-data-table
  :columns="columns"
  :data="data"
  :pagination="pagination"
  :row-key="(row) => row.id"
  striped
  :bordered="false"
/>
```

**列定义**
```typescript
const columns: DataTableColumns<CrawlTask> = [
  {
    title: 'URL',
    key: 'url',
    ellipsis: { tooltip: true },
    sorter: (a, b) => a.url.localeCompare(b.url)
  },
  {
    title: 'Status',
    key: 'status',
    render: (row) => h(NTag, {
      type: row.status === 'completed' ? 'success' : 'warning'
    }, { default: () => row.status })
  }
];
```

#### 分页配置

```typescript
const pagination = {
  pageSize: 20,
  pageSizes: [10, 20, 50, 100],
  showSizePicker: true,
  showQuickJumper: true,
  prefix: ({ itemCount }) => `Total ${itemCount}`
};
```

---

### 4.4 弹窗

#### 尺寸规范

| 类型 | 宽度 | 用途 |
|------|------|------|
| small | 400px | 简单确认 |
| medium | 600px | 表单输入 |
| large | 800px | 内容预览 |
| full | 90vw | 批量导入确认 |

#### 结构规范

```vue
<n-modal
  v-model:show="showModal"
  preset="card"
  title="Title"
  :style="{ width: '600px' }"
  :mask-closable="false"
  :closable="true"
>
  <template #header-extra>
    <n-button circle size="small" @click="showModal = false">
      <template #icon><n-icon><close-icon /></n-icon></template>
    </n-button>
  </template>

  <!-- Content -->
  <n-space vertical size="large">
    ...
  </n-space>

  <template #footer>
    <n-space justify="end">
      <n-button @click="showModal = false">Cancel</n-button>
      <n-button type="primary" @click="confirm">Confirm</n-button>
    </n-space>
  </template>
</n-modal>
```

---

### 4.5 进度显示

#### 进度条组件

```vue
<n-progress
  type="line"
  :percentage="progressPercentage"
  :indicator-placement="'inside'"
  :processing="isRunning"
  :status="progressStatus"
>
  <template #default="{ percentage }">
    {{ percentage }}% ({{ completed }}/{{ total }})
  </template>
</n-progress>

<n-text depth="3" style="font-size: 12px">
  当前：{{ currentUrl }}
</n-text>
```

#### 状态映射

| 状态 | 类型 | 颜色 |
|------|------|------|
| 运行中 | `processing` | 蓝色动画 |
| 成功 | `success` | 绿色 |
| 警告 | `warning` | 橙色 |
| 错误 | `error` | 红色 |
| 默认 | `default` | 灰色 |

---

### 4.6 标签（Tags）

#### 用途规范

| 类型 | 场景 | 示例 |
|------|------|------|
| default | 通用标签 | 标签、分类 |
| info | 来源标识 | Webpage、Markdown |
| success | 成功状态 | Completed、Imported |
| warning | 警告状态 | Partial、Low Quality |
| error | 错误状态 | Failed、Auth Expired |

#### 尺寸规范

```vue
<!-- 小标签：表格内 -->
<n-tag size="small" type="info">Webpage</n-tag>

<!-- 中等标签：列表中 -->
<n-tag type="success">Completed</n-tag>

<!-- 大标签：详情页 -->
<n-tag size="large" type="default">Technology</n-tag>
```

---

## 5. 响应式设计

### 5.1 断点设置

| 断点 | 宽度范围 | 调整策略 |
|------|---------|---------|
| xs | < 768px | 移动设备，单列布局 |
| sm | 768px - 992px | 平板，部分组件调整 |
| md | 992px - 1200px | 小屏幕桌面，两列布局 |
| lg | 1200px - 1600px | 标准桌面，默认布局 |
| xl | > 1600px | 大屏幕，扩展布局 |

### 5.2 布局适配

**移动端（xs）**
- Tab 导航改为下拉选择（`<n-select>`）
- 表单标签改为顶部对齐（`label-placement="top"`）
- 表格改为卡片列表（`<n-list>` 替代 `<n-data-table>`）
- 按钮堆叠显示

**平板（sm）**
- 保持 Tab 导航
- 侧边栏可折叠
- 表格列减少（隐藏次要字段）

**桌面（md+）**
- 默认布局
- 侧边栏展开
- 表格全字段显示

---

## 6. 交互规范

### 6.1 加载状态

#### 全局加载

```vue
<n-spin :show="loading" description="Loading...">
  <!-- Content -->
</n-spin>
```

#### 局部加载

```vue
<!-- 按钮加载 -->
<n-button loading :loading="isCrawling">Crawl</n-button>

<!-- 输框加载 -->
<n-input :loading="isParsing" />

<!-- 表格加载 -->
<n-data-table :loading="isLoading" />
```

#### 骨架屏

```vue
<n-skeleton>
  <n-space vertical>
    <n-skeleton text :repeat="2" />
    <n-skeleton text style="width: 60%" />
  </n-space>
</n-skeleton>
```

---

### 6.2 错误提示

#### 消息提示（Toast）

```vue
<!-- 成功 -->
<n-message type="success" content="Imported successfully" />

<!-- 错误 -->
<n-message type="error" content="Failed to crawl: Network error" />

<!-- 警告 -->
<n-message type="warning" content="Partial completion: 5 failed" />

<!-- 信息 -->
<n-message type="info" content="Crawling in progress..." />
```

#### 对话框

```vue
<n-modal v-model:show="showError" preset="dialog" title="Error" type="error">
  <template #icon>
    <n-icon size="32" color="error">
      <alert-circle-icon />
    </n-icon>
  </template>
  {{ errorMessage }}
  <template #action>
    <n-button type="primary" @click="showError = false">OK</n-button>
  </template>
</n-modal>
```

#### 表单项错误

```vue
<n-form-item :feedback="urlError" :validation-status="urlError ? 'error' : undefined">
  <n-input v-model:value="url" placeholder="Enter URL" />
</n-form-item>
```

---

### 6.3 空状态

#### 列表空状态

```vue
<n-empty
  description="No crawl tasks yet"
>
  <template #extra>
    <n-button size="small" @click="startCrawl">
      Start First Crawl
    </n-button>
  </template>
</n-empty>
```

#### 结果空状态

```vue
<n-result
  status="info"
  title="No URLs Found"
  description="The sitemap does not contain any URLs"
>
  <template #footer>
    <n-button type="primary" @click="backToInput">
      Try Another URL
    </n-button>
  </template>
</n-result>
```

---

### 6.4 确认对话框

#### 危险操作确认

```vue
<n-modal
  v-model:show="showDeleteConfirm"
  preset="dialog"
  title="Delete Confirmation"
  type="warning"
  content="Are you sure you want to delete this task? This action cannot be undone."
  positive-text="Delete"
  negative-text="Cancel"
  @positive-click="handleDelete"
/>
```

#### 覆盖确认

```vue
<n-modal
  v-model:show="showOverwriteConfirm"
  preset="dialog"
  title="Duplicate URL Detected"
  type="warning"
>
  <template #header>
    <n-space align="center">
      <n-icon color="warning" size="24">
        <alert-icon />
      </n-icon>
      <span>URL Already Imported</span>
    </n-space>
  </template>

  <n-space vertical>
    <n-text>This URL was imported on {{ importDate }}</n-text>
    <n-text depth="3">Do you want to overwrite the existing content or create a new copy?</n-text>
  </n-space>

  <template #action>
    <n-space>
      <n-button @click="createCopy">Create Copy</n-button>
      <n-button type="primary" @click="overwrite">Overwrite</n-button>
      <n-button @click="cancel">Cancel</n-button>
    </n-space>
  </template>
</n-modal>
```

---

## 7. 无障碍设计

### 7.1 键盘导航

#### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + K` | 快速搜索（爬取历史） |
| `Cmd/Ctrl + N` | 新建爬取任务 |
| `Cmd/Ctrl + /` | 打开帮助 |
| `Esc` | 关闭弹窗 / 取消操作 |
| `Enter` | 提交表单 / 确认操作 |
| `Tab` | 焦点移动（正向） |
| `Shift + Tab` | 焦点移动（反向） |

#### 焦点管理

```vue
<!-- 自动聚焦 -->
<n-input ref="urlInputRef" v-model:value="url" />

<!-- 焦点陷阱（弹窗） -->
<n-modal
  v-model:show="showModal"
  :trap-focus="true"
  :auto-focus="true"
>
  ...
</n-modal>
```

---

### 7.2 ARIA 标签

#### 语义化标记

```vue
<!-- 按钮标签 -->
<n-button aria-label="Start crawling the URL">Crawl</n-button>

<!-- 表单标签 -->
<n-form-item label="URL" path="url">
  <n-input
    v-model:value="url"
    aria-label="Enter the URL to crawl"
    aria-required="true"
    aria-invalid="urlError ? 'true' : 'false'"
    aria-describedby="url-help"
  />
  <template #feedback>
    <n-text id="url-help" depth="3">
      Enter a valid HTTP/HTTPS URL
    </n-text>
  </template>
</n-form-item>

<!-- 加载状态 -->
<n-spin aria-label="Loading page content" />

<!-- 进度条 -->
<n-progress
  :percentage="progress"
  :aria-valuenow="progress"
  :aria-valuemin="0"
  :aria-valuemax="100"
  aria-label="Crawling progress"
/>
```

---

### 7.3 颜色对比度

#### 对比度要求

- WCAG 2.1 AA 标准：正常文本 >= 4.5:1，大文本 >= 3:1
- 主要文本：`#303133` vs 白色背景 = 12.6:1 ✓
- 次要文本：`#606266` vs 白色背景 = 7.5:1 ✓
- 禁用文本：`#C0C4CC` vs 白色背景 = 2.1:1 ✗（需调整）
- 主按钮：白色文本 vs `#18a058` 背景 = 4.5:1 ✓
- 链接：`#2080f0` vs 白色背景 = 4.6:1 ✓

#### 调整建议

- 禁用文本改为 `#909399`（对比度 4.0:1）
- 边框颜色使用 `#DCDFE6`（对比度 2.7:1，需配合图标使用）
- 错误提示使用 `#d03050`（对比度 5.2:1）

---

## 8. 性能优化

### 8.1 图片优化

#### 懒加载

```vue
<n-image
  src="image-url"
  :lazy="true"
  :preview-src="preview-url"
  object-fit="cover"
/>
```

#### 缩略图

```vue
<n-avatar
  :src="thumbnailUrl"
  :fallback-src="defaultAvatar"
  :img-props="{ loading: 'lazy' }"
/>
```

---

### 8.2 懒加载

#### 路由懒加载

```typescript
const routes = [
  {
    path: '/crawler',
    component: () => import('./views/WebCrawler.vue'),
    meta: { title: 'Web Crawler' }
  }
];
```

#### 组件懒加载

```vue
<script setup lang="ts">
const ContentPreview = defineAsyncComponent(
  () => import('./components/ContentPreview.vue')
);
</script>
```

---

### 8.3 虚拟滚动

#### 大列表优化

```vue
<n-virtual-list
  :items="crawlResults"
  :item-size="80"
  :item-resizable="true"
  :page-size="50"
>
  <template #default="{ item }">
    <CrawlResultItem :result="item" />
  </template>
</n-virtual-list>
```

---

### 8.4 防抖和节流

#### URL 输入防抖

```typescript
import { useDebounceFn } from '@vueuse/core';

const debouncedValidateUrl = useDebounceFn((url: string) => {
  validateUrl(url);
}, 500);

watch(url, (newUrl) => {
  debouncedValidateUrl(newUrl);
});
```

#### 进度轮询节流

```typescript
import { useThrottleFn } from '@vueuse/core';

const throttledPollProgress = useThrottleFn(async () => {
  const progress = await fetchProgress(taskId);
  updateProgress(progress);
}, 1000);
```

---

### 8.5 代码分割

#### API 按需加载

```typescript
// services/crawler.ts
export const crawlSingle = async (url: string) => {
  const response = await fetch('/api/crawl/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return response.json();
};
```

---

## 9. 组件使用示例

### 9.1 URL 输入组件

```vue
<template>
  <n-form-item label="URL" path="url" :feedback="urlError">
    <n-input-group>
      <n-input
        v-model:value="url"
        placeholder="https://example.com/article"
        :status="urlError ? 'error' : undefined"
        @blur="validateUrl"
      >
        <template #prefix>
          <n-icon><link-icon /></n-icon>
        </template>
      </n-input>
      <n-button
        type="primary"
        :disabled="!isValidUrl"
        :loading="isCrawling"
        @click="handleCrawl"
      >
        Crawl
      </n-button>
    </n-input-group>
  </n-form-item>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const url = ref('');
const urlError = ref('');
const isCrawling = ref(false);

const isValidUrl = computed(() => {
  try {
    new URL(url.value);
    return true;
  } catch {
    return false;
  }
});

const validateUrl = () => {
  if (!isValidUrl.value) {
    urlError.value = 'Invalid URL format';
  } else {
    urlError.value = '';
  }
};

const handleCrawl = async () => {
  isCrawling.value = true;
  try {
    // Crawl logic
  } finally {
    isCrawling.value = false;
  }
};
</script>
```

---

### 9.2 内容预览组件

```vue
<template>
  <n-card title="Content Preview" :bordered="false">
    <n-space vertical size="large">
      <!-- 元数据 -->
      <n-descriptions bordered :column="2">
        <n-descriptions-item label="Title">
          {{ preview.title }}
        </n-descriptions-item>
        <n-descriptions-item label="Word Count">
          {{ preview.wordCount }}
        </n-descriptions-item>
        <n-descriptions-item label="Source URL">
          <n-a :href="preview.url" target="_blank">
            {{ preview.url }}
          </n-a>
        </n-descriptions-item>
        <n-descriptions-item label="Quality Score">
          <n-tag :type="getQualityType(preview.qualityScore)">
            {{ (preview.qualityScore * 100).toFixed(0) }}%
          </n-tag>
        </n-descriptions-item>
      </n-descriptions>

      <!-- 标题编辑 -->
      <n-form-item label="Edit Title">
        <n-input
          v-model:value="editableTitle"
          placeholder="Document title"
        />
      </n-form-item>

      <!-- 标签 -->
      <n-form-item label="Tags">
        <n-dynamic-tags v-model:value="tags" />
      </n-form-item>

      <!-- 内容预览 -->
      <n-collapse>
        <n-collapse-item title="Preview Content" name="content">
          <n-scrollbar style="max-height: 400px">
            <n-text>
              {{ preview.content }}
            </n-text>
          </n-scrollbar>
        </n-collapse-item>
      </n-collapse>

      <!-- 操作按钮 -->
      <n-space justify="end">
        <n-button @click="$emit('cancel')">Cancel</n-button>
        <n-button type="primary" @click="handleImport">
          Import as Note
        </n-button>
      </n-space>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  preview: {
    title: string;
    content: string;
    url: string;
    wordCount: number;
    qualityScore: number;
  };
}>();

const emit = defineEmits(['cancel', 'import']);

const editableTitle = ref(props.preview.title);
const tags = ref<string[]>([]);

const getQualityType = (score: number) => {
  if (score >= 0.8) return 'success';
  if (score >= 0.5) return 'warning';
  return 'error';
};

const handleImport = () => {
  emit('import', {
    title: editableTitle.value,
    content: props.preview.content,
    url: props.preview.url,
    tags: tags.value
  });
};
</script>
```

---

### 9.3 批量爬取进度组件

```vue
<template>
  <n-card title="Crawling Progress" :bordered="false">
    <n-space vertical size="large">
      <!-- 进度条 -->
      <n-space vertical>
        <n-space justify="space-between">
          <n-text>Progress</n-text>
          <n-text>{{ completed }} / {{ total }}</n-text>
        </n-space>
        <n-progress
          type="line"
          :percentage="percentage"
          :indicator-placement="'inside'"
          :processing="isRunning"
        />
      </n-space>

      <!-- 统计信息 -->
      <n-grid :cols="3" :x-gap="12">
        <n-grid-item>
          <n-statistic label="Success" :value="stats.success">
            <template #prefix>
              <n-icon color="success"><check-icon /></n-icon>
            </template>
          </n-statistic>
        </n-grid-item>
        <n-grid-item>
          <n-statistic label="Failed" :value="stats.failed">
            <template #prefix>
              <n-icon color="error"><close-icon /></n-icon>
            </template>
          </n-statistic>
        </n-grid-item>
        <n-grid-item>
          <n-statistic label="Remaining" :value="stats.remaining">
            <template #prefix>
              <n-icon color="info"><time-icon /></n-icon>
            </template>
          </n-statistic>
        </n-grid-item>
      </n-grid>

      <!-- 当前任务 -->
      <n-alert v-if="currentUrl" type="info" :bordered="false">
        <n-space align="center">
          <n-spin :size="16" />
          <n-text>Crawling: {{ currentUrl }}</n-text>
        </n-space>
      </n-alert>

      <!-- 操作按钮 -->
      <n-space>
        <n-button
          v-if="!isPaused"
          type="warning"
          @click="$emit('pause')"
        >
          Pause
        </n-button>
        <n-button
          v-else
          type="info"
          @click="$emit('resume')"
        >
          Resume
        </n-button>
        <n-button
          type="error"
          @click="$emit('terminate')"
        >
          Terminate
        </n-button>
      </n-space>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  total: number;
  completed: number;
  failed: number;
  currentUrl?: string;
  isRunning: boolean;
  isPaused: boolean;
}>();

defineEmits(['pause', 'resume', 'terminate']);

const percentage = computed(() => {
  return Math.round((props.completed / props.total) * 100);
});

const stats = computed(() => ({
  success: props.completed - props.failed,
  failed: props.failed,
  remaining: props.total - props.completed
}));
</script>
```

---

### 9.4 认证过期处理组件

```vue
<template>
  <n-modal
    v-model:show="showAuthExpiredModal"
    preset="card"
    title="认证已过期"
    :style="{ width: '600px' }"
    :mask-closable="false"
    :closable="false"
  >
    <n-space vertical size="large">
      <!-- 警告提示 -->
      <n-alert type="warning" :bordered="false">
        <template #header>
          <n-space align="center">
            <n-icon :component="WarningIcon" size="24" />
            <span>批量爬取任务已暂停</span>
          </n-space>
        </template>
        第 {{ currentIndex + 1 }} 页（共 {{ totalUrls }} 页）爬取失败，
        检测到需要登录认证。已成功完成 {{ completed }} 页。
      </n-alert>

      <!-- 任务进度 -->
      <n-progress
        type="line"
        :percentage="progressPercentage"
        :status="progressStatus"
        :indicator-placement="'inside'"
      >
        <template #default="{ percentage }">
          {{ percentage }}% ({{ completed }}/{{ totalUrls }})
        </template>
      </n-progress>

      <!-- 失败 URL 信息 -->
      <n-collapse>
        <n-collapse-item title="查看失败详情" name="details">
          <n-code language="json" :code="failedUrlInfo" />
        </n-collapse-item>
      </n-collapse>

      <!-- 操作选项 -->
      <n-divider />

      <n-text>请选择处理方式：</n-text>

      <n-space vertical size="medium">
        <!-- 选项 1：重新登录并继续 -->
        <n-card hoverable size="small" @click="handleRelogin">
          <template #header>
            <n-space align="center">
              <n-icon :component="RefreshIcon" />
              <span>重新登录并继续</span>
            </n-space>
          </template>
          <n-text depth="3">在浏览器中重新登录后，任务将从第 {{ currentIndex + 1 }} 页继续执行。</n-text>
        </n-card>

        <!-- 选项 2：跳过该页继续 -->
        <n-card hoverable size="small" @click="handleSkip">
          <template #header>
            <n-space align="center">
              <n-icon :component="SkipIcon" />
              <span>跳过该页继续</span>
            </n-space>
          </template>
          <n-text depth="3">标记当前页为失败，继续爬取后续页面。</n-text>
        </n-card>

        <!-- 选项 3：终止任务 -->
        <n-card hoverable size="small" @click="handleTerminate">
          <template #header>
            <n-space align="center">
              <n-icon :component="StopIcon" />
              <span>终止任务</span>
            </n-space>
          </template>
          <n-text depth="3">保存已完成的结果，进入导入确认界面。</n-text>
        </n-card>
      </n-space>
    </n-space>

    <template #footer>
      <n-space justify="end">
        <n-button @click="showAuthExpiredModal = false">
          稍后处理
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { WarningIcon, RefreshIcon, SkipIcon, StopIcon } from '@vicons/ionicons5';

const props = defineProps<{
  taskId: string;
  currentIndex: number;
  totalUrls: number;
  completed: number;
  failedUrl: string;
  failedUrlInfo: object;
}>();

const showAuthExpiredModal = ref(true);

const progressPercentage = computed(() =>
  Math.round((props.completed / props.totalUrls) * 100)
);

const progressStatus = computed(() => 'warning');

const handleRelogin = async () => {
  // 打开浏览器登录流程
  await openBrowserLogin(props.taskId);
  showAuthExpiredModal.value = false;
};

const handleSkip = () => {
  // 标记当前页为失败，继续下一页
  skipCurrentPage(props.taskId);
  showAuthExpiredModal.value = false;
};

const handleTerminate = () => {
  // 终止任务，进入导入确认
  terminateTask(props.taskId);
  showAuthExpiredModal.value = false;
};
</script>
```

---

## 10. 设计交付物

### 10.1 设计资源

**组件库**
- Naive UI 组件文档：https://www.naiveui.com/
- 图标库：@vicons/ionicons5（已集成）

**设计文件**
- Figma 设计稿（可选）：待创建
- 原型图：待创建

**开发资源**
- 组件代码示例：本文档第 9 节
- API 接口文档：`/docs/prd/feature-web-crawler.md`
- 技术架构文档：`/docs/architecture/feature-web-crawler.md`

---

### 10.2 开发检查清单

#### 功能完整性

- [ ] 单页面爬取：URL 输入、爬取、预览、导入
- [ ] 站点地图爬取：Sitemap 解析、URL 选择、批量爬取
- [ ] 递归爬取：链接发现、深度控制、过滤规则
- [ ] 认证管理：Cookie 注入、Header 注入、浏览器登录
- [ ] 爬取历史：任务列表、状态筛选、重试/删除
- [ ] 批量导入确认：结果列表、质量评分、批量操作

#### UI/UX 完整性

- [ ] 响应式布局：xs/sm/md/lg/xl 断点适配
- [ ] 加载状态：全局加载、局部加载、骨架屏
- [ ] 错误处理：错误提示、空状态、重试机制
- [ ] 交互反馈：按钮状态、进度显示、成功/失败提示
- [ ] 无障碍：键盘导航、ARIA 标签、颜色对比度

#### 性能优化

- [ ] 路由懒加载
- [ ] 组件懒加载
- [ ] 虚拟滚动（大列表）
- [ ] 防抖和节流
- [ ] 图片懒加载

---

## 附录

### A. 术语对照表

| 中文 | 英文 | 说明 |
|------|------|------|
| 爬取 | Crawl | 网页内容抓取 |
| 站点地图 | Sitemap | 网站地图文件 |
| 递归爬取 | Recursive Crawl | 自动发现子页面 |
| 认证 | Auth | 登录状态管理 |
| 批量导入 | Batch Import | 一次性导入多个 |
| 内容清洗 | Content Cleaning | 去除无关内容 |
| 质量评分 | Quality Score | 内容质量评分 |
| 向量化 | Vectorization | 文档向量化 |

---

### B. 参考资料

**内部文档**
- `/docs/prd/feature-web-crawler.md` - Web Crawler PRD
- `/docs/architecture/feature-web-crawler.md` - 技术架构设计
- `/src/client/src/views/Documents.vue` - Documents 页面参考

**外部资源**
- [Naive UI 官方文档](https://www.naiveui.com/)
- [Vue 3 官方文档](https://vuejs.org/)
- [WCAG 2.1 标准](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design 设计指南](https://material.io/design)

---

**文档结束**
