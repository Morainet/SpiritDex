"""scraper 入口：拉取 BWIKI Lua 数据模块 → 解析 → 转换 → 写出 data/seed/*.json。

用法::

    python3 main.py                    # 实时拉取（联网，QPS≤1）
    python3 main.py --offline          # 用 tests/fixtures 缓存（离线/CI）
    python3 main.py --dry-run          # 只转换不写文件，打印计数
    python3 main.py --offline --stats  # 仅打印统计

合规：QPS≤1、自定义 UA、每条记录带 source_url、只取事实数据。
"""

from __future__ import annotations

import argparse
import os
import sys

# 支持直接 ``python3 main.py`` 运行（无需安装为包）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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
    args = parser.parse_args(argv)

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


if __name__ == "__main__":
    raise SystemExit(main())
