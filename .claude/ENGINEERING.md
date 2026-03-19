# Local RAG 项目工程规范

本文档定义了 local-rag 项目的工程规范，所有代码变更和开发工作都应遵循这些标准。

## 项目概览

**技术栈：**
- **后端：** Node.js 18+, Express.js, TypeScript (ES2022, NodeNext)
- **前端：** Vue 3, Naive UI, Vite, TypeScript
- **爬虫：** Playwright (Chromium)
- **日志：** Winston 结构化日志 (ECS 标准)
- **包管理：** pnpm workspaces (monorepo)
- **代码质量：** ESLint, Prettier

**项目结构：**
```
local-rag/
├── apps/
│   ├── api/          # Express.js 后端服务
│   ├── web/          # Vue 3 前端应用
│   └── mcp-server/   # MCP 服务器
├── packages/
│   ├── shared/       # 共享类型和工具
│   └── config/       # 配置包
└── .claude/          # Claude 项目配置和 skills
```

## 代码规范

### TypeScript 规范

#### 模块导入与导出

**优先使用命名导出 (named exports)：**
```typescript
// ✅ 推荐
export function foo() {}
export const bar = 1;
export type { Baz };

// ❌ 避免（除非明确需要默认导出）
export default function foo() {}
```

**导入时使用明确的命名导入：**
```typescript
// ✅ 推荐
import { foo, bar } from './module.js';
import type { Baz } from './types.js';

// ❌ 避免
import * as Module from './module.js';  // 仅在特定场景使用
```

**始终使用 `.js` 扩展名（即使实际文件是 `.ts`）：**
```typescript
// ✅ 推荐
import { foo } from './module.js';

// ❌ 避免
import { foo } from './module';
import { foo } from './module.ts';
```

#### 类型定义

**函数必须有明确的返回类型：**
```typescript
// ✅ 推荐
function getUser(id: string): Promise<User> {
  return db.getUser(id);
}

// ❌ 避免
function getUser(id: string) {
  return db.getUser(id);
}
```

**使用 interface 定义对象类型，type 定义联合类型：**
```typescript
// ✅ 推荐 - interface 用于对象形状
interface User {
  id: string;
  name: string;
}

// ✅ 推荐 - type 用于联合/交叉类型
type Status = 'pending' | 'running' | 'completed';
type UserWithStatus = User & { status: Status };
```

#### 异步处理

**优先使用 async/await：**
```typescript
// ✅ 推荐
async function fetchData() {
  const result = await api.call();
  return process(result);
}

// ❌ 避免
function fetchData() {
  return api.call().then(result => process(result));
}
```

**错误必须被正确处理和类型化：**
```typescript
// ✅ 推荐
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof Error) {
    logger.error('操作失败', error, { context });
  } else {
    logger.error('操作失败', new Error(String(error)));
  }
}

// ❌ 避免
try {
  await riskyOperation();
} catch (error) {
  console.error(error);  // 类型不安全
}
```

### 日志规范

**使用结构化日志 (ECS 标准)：**
```typescript
import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'module-name');

// ✅ 推荐 - 结构化日志
logger.info('用户登录', { userId, ip });
logger.error('处理失败', error, { requestId, documentId });
logger.warn('资源使用率高', null, { cpu: 80, memory: 85 });

// ❌ 避免 - 非结构化日志
console.log('用户登录');
console.error('处理失败: ' + error.message);
```

**日志级别使用：**
- `error`：错误导致功能失败
- `warn`：潜在问题，但系统仍可运行
- `info`：重要业务事件
- `debug`：详细调试信息（生产环境禁用）

### 错误处理规范

**使用自定义错误类：**
```typescript
// ✅ 推荐
import { createError } from '../middleware/error-handler.js';

throw createError(404, 'TASK_NOT_FOUND', '任务不存在');

// ❌ 避免
throw new Error('任务不存在');
res.status(404).send('任务不存在');
```

**Express 路由错误处理：**
```typescript
// ✅ 推荐
router.get('/resource/:id', async (req, res, next) => {
  try {
    const data = await getResource(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);  // 传递给错误处理中间件
  }
});
```

### 代码组织规范

**文件命名：**
- TypeScript 文件：`kebab-case.ts` (如 `user-service.ts`)
- Vue 组件：`PascalCase.vue` (如 `UserProfile.vue`)
- 测试文件：`*.test.ts` 或 `*.spec.ts`

**目录组织：**
```
src/
├── routes/         # 路由定义
├── services/       # 业务逻辑
├── middleware/     # Express 中间件
├── utils/          # 工具函数
├── types/          # 类型定义（如果无法放在 shared）
└── index.ts        # 入口文件
```

**避免循环依赖：**
- 如果模块 A 依赖 B，B 不应依赖 A
- 使用共享类型 (`@local-rag/shared`) 打破循环依赖

### 代码质量规则

**必须避免的常见问题：**

1. **无限递归：**
```typescript
// ❌ 危险 - 无限递归导致栈溢出
export function getIgnoreConfig() {
  return getIgnoreConfig();  // 调用自己！
}

// ✅ 正确
export function getIgnorePatterns(): string[] {
  return getAllIgnorePatterns();  // 调用外部函数
}
```

2. **导出冲突：**
```typescript
// ❌ 避免在不同模块中导出同名函数
// crawler-service.ts
export async function deleteSession(domain: string) { ... }

// session-manager.ts
export async function deleteSession(domain: string) { ... }

// ✅ 正确 - 统一导出源
// session-manager.ts
export async function deleteSession(domain: string) { ... }

// crawler-service.ts
// 删除重复导出，直接从 session-manager 导入
```

3. **console 替代 logger：**
```typescript
// ❌ 避免
console.error('错误:', error);
console.log('信息:', data);

// ✅ 正确
logger.error('错误', error as Error, { data });
logger.info('信息', { data });
```

## API 设计规范

**RESTful API 响应格式：**
```typescript
// 成功响应
{
  "success": true,
  "data": { ... }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "任务不存在",
    "details": { ... }
  }
}
```

**路由命名：**
- 使用 kebab-case：`/api/crawler/tasks`
- 使用复数名词：`/users` 而非 `/user`
- 资源嵌套：`/users/:id/posts`

## 前端规范

**Vue 3 Composition API：**
```vue
<script setup lang="ts">
import { ref, computed } from 'vue';

// ✅ 推荐 - 使用 <script setup>
const count = ref(0);
const doubled = computed(() => count.value * 2);

// ❌ 避免 - Options API（除非有特殊原因）
export default {
  data() { return { count: 0 } }
}
</script>
```

**组件命名：**
- 组件文件使用 PascalCase：`UserProfile.vue`
- 组件注册使用 kebab-case：`<user-profile />`

**UI 组件库：**
- 优先使用 Naive UI 组件
- 遵循 Naive UI 设计规范

## Git 工作流

**提交信息格式：**
```
<type>: <subject>

[optional body]

[type](scope): description
```

**类型 (type)：**
- `feat`: 新功能
- `fix`: Bug 修复
- `refactor`: 代码重构
- `docs`: 文档更新
- `style`: 代码格式调整
- `test`: 测试相关
- `chore`: 构建/工具配置

**示例：**
```
fix: 修复 ignore-rules.ts 无限递归导致的栈溢出

- 将 getIgnoreConfig() 重命名为 getIgnorePatterns()
- 修复函数调用自身而非外部函数的问题

问题来源: 日志分析器 skill 分析结果
```

## 开发流程规范

**在编写代码前：**
1. 确认需求是否需要规划复杂实现（考虑使用 plan mode）
2. 检查是否存在相关模块可复用
3. 确认遵循现有代码模式

**在编写代码时：**
1. 优先编辑现有文件，而非创建新文件
2. 保持代码简洁，避免过度工程化
3. 添加必要的 JSDoc 注释（非显而易见的逻辑）
4. 确保类型安全

**在提交代码前：**
1. 运行 `pnpm lint` 检查代码规范
2. 运行 `pnpm build` 确保构建成功
3. 测试核心功能是否正常
4. 检查是否引入了安全漏洞

## 安全规范

**敏感数据处理：**
- 永远不要在日志中输出密码、token 等敏感信息
- 使用环境变量存储配置，不要硬编码
- 遵循最小权限原则

**输入验证：**
```typescript
// ✅ 推荐 - 验证输入
if (!url || typeof url !== 'string') {
  throw createError(400, 'INVALID_INPUT', '请提供有效的 URL');
}

// ❌ 避免 - 未验证直接使用
await processUrl(req.body.url);
```

## 测试规范

**测试覆盖：**
- 核心业务逻辑必须有单元测试
- 关键 API 端点必须有集成测试
- 测试文件与源文件同级

**测试命名：**
```typescript
// ✅ 推荐 - 清晰的测试描述
describe('UserService', () => {
  it('should return user when id exists', async () => {
    // ...
  });

  it('should throw error when user not found', async () => {
    // ...
  });
});
```

## 性能规范

**避免：**
- 在循环中进行重复计算
- 不必要的内存占用
- 阻塞主线程的长时间操作

**推荐：**
- 使用流处理大文件
- 合理使用缓存
- 异步处理耗时操作

## 文档规范

**代码注释：**
- 复杂逻辑必须有注释说明
- 公共 API 必须有 JSDoc 注释
- 注释应说明"为什么"而非"是什么"

**README 更新：**
- 新增功能时更新相关文档
- 重大变更时更新 CHANGELOG

## 工具配置

**必需的配置文件：**
- `tsconfig.json` - TypeScript 配置
- `.prettierrc` - 代码格式化配置
- `eslint.config.js` - 代码检查配置
- `.gitignore` - Git 忽略规则

**推荐的开发工具：**
- VS Code + Vue Language Features (Volar)
- TypeScript ESLint 插件
- Prettier 插件

## Claude AI 协作规范

**当 Claude 处理本项目的需求时，必须：**

1. **优先遵循本文档规范** - 所有代码变更应符合上述标准
2. **参考现有代码模式** - 查看类似模块的实现方式
3. **使用项目工具** - 使用 log-analyzer skill 分析问题
4. **保持代码简洁** - 避免不必要的抽象和过度设计
5. **确保类型安全** - 充分利用 TypeScript 类型系统
6. **正确处理错误** - 使用统一的错误处理机制
7. **结构化日志** - 使用 Winston logger 而非 console
8. **遵循导入规范** - 使用命名导入和 .js 扩展名

**在以下情况下主动使用 code-reviewer：**
- 完成重要功能实现后
- 修复 bug 后
- 用户明确要求代码审查时
- 涉及安全相关的代码变更时

**项目特定约定：**
- 日志使用 ECS 结构化格式
- 错误通过 `createError()` 创建
- 会话管理由 SessionManager 模块统一提供
- 配置从 `@local-rag/config` 包导入
- 共享类型从 `@local-rag/shared` 包导入
