---
name: log-analyzer
description: 分析 local-rag 项目日志的 skill。使用此 skill 当需要按时间范围筛选、合并和分析 logs 目录下的 .log 文件时。
---

# Log Analyzer

分析 local-rag 项目日志的专用 skill。

## 日志格式

项目使用 winston 结构化日志格式，每行一个 JSON 对象：

```json
{"@timestamp":"2026-03-19T04:47:09.275Z","level":"info","message":"API 服务器启动","module":"main",...}
```

时间字段为 `@timestamp`（ISO 8601 格式）和 `readableTime`（本地可读格式）。

## 使用此 Skill

当用户需要分析日志时，按以下步骤执行：

### 1. 确定时间范围

从用户请求中获取时间范围，例如：
- "分析今天 12:00 到 14:00 的日志"
- "查看最近 1 小时的错误日志"

### 2. 执行日志合并脚本

使用 `scripts/merge_logs.py` 筛选并合并日志：

```bash
python3 .claude/skills/log-analyzer/scripts/merge_logs.py <start-time> <end-time>
```

时间格式支持：
- ISO 8601: `2026-03-19T12:00:00`
- 简短格式: `2026-03-19 12:00:00`
- 相对时间: `1h ago`、`30m ago`
- 当前时间: `now`（作为结束时间）

脚本会：
1. 读取 `logs/` 目录下所有 `.log` 文件
2. 根据 `@timestamp` 筛选指定时间范围的日志
3. 将结果合并到 `logs/merged-<timestamp>.log`
4. 输出筛选后的日志条数

### 3. 分析合并后的日志

读取生成的合并日志文件进行分析：
- 错误统计（`level: "error"`）
- 请求分析（`module: "request"`）
- 性能问题（`http.duration` 过高）
- 异常堆栈追踪

## 日志文件位置

- 源日志：`logs/api/*.log`
- 合并输出：`logs/merged-<timestamp>.log`
