# Web Crawler 测试文件清单

## 测试文件位置

### 单元测试

#### 1. ContentCleanerService 测试
**文件路径**: `/Users/jilong5/mfe-workspace/local-rag/src/server/services/__tests__/content-cleaner.test.ts`

**测试内容**:
- 内容清洗（移除导航、页脚、侧边栏）
- 主体内容提取（main/article 选择器）
- Script/Style 标签移除
- 代码块和表格结构保留
- 质量评分计算
- XSS 防护（DOMPurify）
- 登录页检测

**测试用例数**: 21
**通过数**: 17
**失败数**: 4

---

#### 2. UrlUtil 测试
**文件路径**: `/Users/jilong5/mfe-workspace/local-rag/src/shared/utils/__tests__/url.test.ts`

**测试内容**:
- URL 验证（HTTP/HTTPS）
- URL 标准化（移除 hash、追踪参数）
- 重复 URL 检测
- 域名提取
- 同域名检查
- URL 过滤和去重
- URL 过滤规则

**测试用例数**: 59
**通过数**: 56
**失败数**: 3

---

#### 3. EncryptionUtil 测试
**文件路径**: `/Users/jilong5/mfe-workspace/local-rag/src/server/utils/__tests__/encryption.test.ts`

**测试内容**:
- Cookie/Token 加密和解密
- 密钥生成和存储
- 机器标识密钥生成
- 密钥重新生成
- 错误处理（损坏数据、错误密钥）
- 加密格式验证（AES-256-GCM）
- 安全属性验证

**测试用例数**: ~50 (已编写但未执行)
**通过数**: 0
**失败数**: 0
**状态**: ❌ Mock 配置错误，无法执行

---

#### 4. AuthSessionManagerService 测试
**文件路径**: `/Users/jilong5/mfe-workspace/local-rag/src/server/services/__tests__/auth-session-manager.test.ts`

**测试内容**:
- Cookie 认证保存和应用
- Header 认证保存和应用
- 浏览器登录会话管理
- Cookie 字符串解析
- GUI 环境检测
- 认证配置应用
- 错误处理

**测试用例数**: ~40 (已编写但未执行)
**通过数**: 0
**失败数**: 0
**状态**: ❌ Mock 配置错误，无法执行

---

## 测试执行命令

### 运行所有 Web Crawler 测试
```bash
pnpm test src/server/services/__tests__/content-cleaner.test.ts \
         src/shared/utils/__tests__/url.test.ts \
         src/server/utils/__tests__/encryption.test.ts \
         src/server/services/__tests__/auth-session-manager.test.ts
```

### 运行单个测试文件
```bash
# Content Cleaner
pnpm test src/server/services/__tests__/content-cleaner.test.ts

# URL Util
pnpm test src/shared/utils/__tests__/url.test.ts

# Encryption
pnpm test src/server/utils/__tests__/encryption.test.ts

# Auth Session Manager
pnpm test src/server/services/__tests__/auth-session-manager.test.ts
```

### 运行测试并生成覆盖率报告
```bash
pnpm test --coverage
```

---

## 测试数据

### 测试覆盖的源文件

1. `/Users/jilong5/mfe-workspace/local-rag/src/server/services/content-cleaner.service.ts`
2. `/Users/jilong5/mfe-workspace/local-rag/src/shared/utils/url.ts`
3. `/Users/jilong5/mfe-workspace/local-rag/src/server/utils/encryption.ts`
4. `/Users/jilong5/mfe-workspace/local-rag/src/server/services/auth-session-manager.service.ts`

---

## 相关文档

- **测试计划**: `/Users/jilong5/mfe-workspace/local-rag/docs/test-plans/feature-web-crawler.md`
- **测试结果**: `/Users/jilong5/mfe-workspace/local-rag/docs/test-plans/feature-web-crawler-results-round-1.md`
- **测试总结**: `/Users/jilong5/mfe-workspace/local-rag/docs/test-plans/feature-web-crawler-summary-round-1.md`
- **PRD**: `/Users/jilong5/mfe-workspace/local-rag/docs/prd/feature-web-crawler.md`
- **架构设计**: `/Users/jilong5/mfe-workspace/local-rag/docs/architecture/feature-web-crawler.md`

---

## 测试框架配置

**配置文件**: `/Users/jilong5/mfe-workspace/local-rag/vitest.config.ts`

**测试框架**: Vitest v1.6.1
**断言库**: Chai (集成)
**Mock 框架**: Vitest vi

---

**最后更新**: 2026-04-01
**维护者**: QA Engineer
