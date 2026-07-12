"""scraper 入口：拉取 BWIKI Lua 数据模块 → 解析 → 转换 → 写出 data/seed/*.json。

用法::

    python3 main.py                    # 实时拉取（联网，QPS≤1）
    python3 main.py --offline          # 用 tests/fixtures 缓存（离线/CI）
    python3 main.py --dry-run          # 只转换不写文件，打印计数
    python3 main.py --offline --stats  # 仅打印统计
    python3 main.py --activities       # 仅抓取活动公告（→ activities.json）
    python3 main.py --activities --max-activities 5

合规：QPS≤1、自定义 UA、每条记录带 source_url、只取事实数据。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

# 支持直接 ``python3 main.py`` 运行（无需安装为包）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.activity_fetcher import fetch_activities   # noqa: E402
from src.api import WikiApi                        # noqa: E402
from src.config import settings                    # noqa: E402
from src.exporters import write_all                # noqa: E402
from src.fetcher import fetch                      # noqa: E402
from src.transformers import transform             # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="SpiritDex 抓取脚本（BWIKI Lua 模块 → data/seed）")
    parser.add_argument("--offline", action="store_true", help="用 tests/fixtures 缓存，不联网")
    parser.add_argument("--dry-run", action="store_true", help="只转换不写文件")
    parser.add_argument("--stats", action="store_true", help="打印各文件计数")
    parser.add_argument("--seed-dir", default=None, help=f"输出目录（默认 {settings.seed_dir}）")
    parser.add_argument("--activities", action="store_true",
                        help="仅抓取活动公告（输出 activities.json，供后端 AI 攻略生成）")
    parser.add_argument("--max-activities", type=int, default=10,
                        help="活动抓取最大条目数（默认 10）")
    args = parser.parse_args(argv)

    # —— 活动抓取分支（独立于宠物数据主流程）——
    if args.activities:
        return _run_activities(args)

    api = None if args.offline else WikiApi()
    print(f"[fetch] 模式={'离线(fixture缓存)' if args.offline else '在线(BWIKI API)'} ...")
    raw = fetch(api, use_fixture_cache=args.offline)
    print(
        f"[fetch] 解析完成：core={len(raw.core)} skills={len(raw.skills)} "
        f"evolutions={len(raw.evolutions)} handbook={len(raw.handbook)}"
    )

    all_items = transform(raw)
    print("[transform] 各 seed 文件计数：")
    for name, items in all_items.items():
        print(f"    {name:18s} {len(items):>5d}")

    if args.stats:
        return 0
    if args.dry_run:
        print("[export] --dry-run，跳过写文件")
        return 0

    written = write_all(all_items, seed_dir=args.seed_dir)
    print(f"[export] 已写出 {len(written)} 个文件到 {os.path.dirname(next(iter(written.values())))}:")
    for name, path in written.items():
        print(f"    {path}")
    return 0


def _run_activities(args: argparse.Namespace) -> int:
    """抓取活动公告并写出 activities.json。"""
    if args.offline:
        print("[activity] --activities 不支持离线模式（需联网拉首页/搜索）")
        return 1
    api = WikiApi()
    print(f"[activity] 抓取最新活动（最多 {args.max_activities} 条）...")
    items = fetch_activities(api, max_items=args.max_activities)
    print(f"[activity] 取到 {len(items)} 条活动")
    for it in items:
        print(f"    - {it.get('name')}  {it.get('source_url') or ''}")

    if args.dry_run:
        print("[activity] --dry-run，跳过写文件")
        return 0

    out_dir = args.seed_dir or settings.seed_dir
    os.makedirs(out_dir, exist_ok=True)
    payload = {
        "meta": {
            "source": settings.source_name,
            "source_url": settings.api_base,
            "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(items),
        },
        "items": items,
    }
    path = os.path.join(out_dir, "activities.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[activity] 已写出 {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
