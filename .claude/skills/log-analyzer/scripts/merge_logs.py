#!/usr/bin/env python3
"""
日志合并脚本 - 按时间范围筛选并合并 logs 目录下的所有 .log 文件
"""

import os
import json
import glob
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


def parse_time(time_str: str, reference: datetime = None) -> datetime:
    """解析时间字符串，支持多种格式。返回本地时间（naive datetime）"""
    if reference is None:
        reference = datetime.now()

    # 特殊关键字 "now"
    if time_str.lower() == 'now':
        return reference

    # 相对时间格式
    if time_str.endswith(' ago'):
        parts = time_str[:-4].strip()
        if parts.endswith('h'):
            hours = int(parts[:-1])
            return reference - timedelta(hours=hours)
        elif parts.endswith('m'):
            minutes = int(parts[:-1])
            return reference - timedelta(minutes=minutes)
        elif parts.endswith('s'):
            seconds = int(parts[:-1])
            return reference - timedelta(seconds=seconds)

    # ISO 8601 格式（可能带时区）
    try:
        dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        # 转换为本地时间
        if dt.tzinfo is not None:
            dt = dt.astimezone().replace(tzinfo=None)
        return dt
    except:
        pass

    # 简短格式: 2026-03-19 12:00:00 (视为本地时间)
    try:
        return datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
    except:
        pass

    # 仅日期: 2026-03-19 (视为本地时间)
    try:
        return datetime.strptime(time_str, '%Y-%m-%d')
    except:
        pass

    raise ValueError(f"无法解析时间格式: {time_str}")


def find_log_files(project_root: str) -> list[str]:
    """查找项目 logs 目录下所有 .log 文件"""
    logs_dir = os.path.join(project_root, 'logs')
    return glob.glob(os.path.join(logs_dir, '**/*.log'), recursive=True)


def filter_logs_by_time(log_files: list[str], start_time: datetime, end_time: datetime) -> list[dict]:
    """筛选指定时间范围内的日志条目"""
    filtered = []

    for log_file in log_files:
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        log_entry = json.loads(line)
                        timestamp_str = log_entry.get('@timestamp')
                        if timestamp_str:
                            # 解析 ISO 8601 时间戳（UTC）
                            log_time_utc = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            # 转换为本地时间
                            log_time_local = log_time_utc.astimezone().replace(tzinfo=None)

                            if start_time <= log_time_local <= end_time:
                                # 添加来源文件信息
                                log_entry['_source_file'] = os.path.basename(log_file)
                                filtered.append(log_entry)
                    except (json.JSONDecodeError, ValueError) as e:
                        # 跳过无效的 JSON 行
                        continue
        except Exception as e:
            print(f"警告: 读取文件 {log_file} 时出错: {e}", file=sys.stderr)

    return filtered


def main():
    if len(sys.argv) < 3:
        print("用法: python3 merge_logs.py <start-time> <end-time>", file=sys.stderr)
        print("", file=sys.stderr)
        print("时间格式示例:", file=sys.stderr)
        print("  ISO 8601:    2026-03-19T12:00:00", file=sys.stderr)
        print("  简短格式:    2026-03-19 12:00:00", file=sys.stderr)
        print("  相对时间:    2h ago, 30m ago", file=sys.stderr)
        sys.exit(1)

    start_time_str = sys.argv[1]
    end_time_str = sys.argv[2]

    # 获取项目根目录（脚本位于 .claude/skills/log-analyzer/scripts/）
    script_dir = Path(__file__).parent
    project_root = str(script_dir.parent.parent.parent.parent)

    # 解析时间
    try:
        start_time = parse_time(start_time_str)
        end_time = parse_time(end_time_str)
    except ValueError as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"时间范围: {start_time} ~ {end_time}")

    # 查找日志文件
    log_files = find_log_files(project_root)
    if not log_files:
        print("错误: 未找到日志文件", file=sys.stderr)
        sys.exit(1)

    print(f"找到 {len(log_files)} 个日志文件")

    # 筛选日志
    filtered_logs = filter_logs_by_time(log_files, start_time, end_time)
    print(f"筛选出 {len(filtered_logs)} 条日志")

    if not filtered_logs:
        print("警告: 没有找到符合条件的日志", file=sys.stderr)
        sys.exit(0)

    # 写入合并文件
    output_dir = os.path.join(project_root, 'logs')
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(output_dir, f'merged-{timestamp}.log')

    with open(output_file, 'w', encoding='utf-8') as f:
        for log_entry in filtered_logs:
            f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')

    print(f"合并日志已写入: {output_file}")


if __name__ == '__main__':
    main()
