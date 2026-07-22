"""scraper 入口：拉取 BWIKI Lua 数据模块 → 解析 → 转换 → 写出 data/seed/*.json。

用法::

    python3 main.py                    # 实时拉取（联网，QPS≤1）
    python3 main.py --offline          # 用 tests/fixtures 缓存（离线/CI）
    python3 main.py --dry-run          # 只转换不写文件，打印计数
    python3 main.py --offline --stats  # 仅打印统计
    python3 main.py --activities       # 仅抓取活动公告（→ activities.json）
    python3 main.py --activities --max-activities 5
    python3 main.py --skill-pools      # 抓取完整技能池 native/stone/blood（→ 覆盖 pet_skills.json）
    python3 main.py --items            # 抓取道具图鉴（Category:道具 → items.json；约 30 分钟）
    python3 main.py --quests           # 抓取任务图鉴（Category:任务 → quests.json；约 20 秒）
    python3 main.py --marks            # 抓取印记图鉴（总览页+独立页 → marks.json；约 15 秒）

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
from src.item_fetcher import fetch_items            # noqa: E402
from src.map_fetcher import fetch_map_points        # noqa: E402
from src.mark_fetcher import fetch_marks            # noqa: E402
from src.quest_fetcher import fetch_quests          # noqa: E402
from src.skill_pool_fetcher import fetch_skill_pools  # noqa: E402
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
    parser.add_argument("--skill-pools", action="store_true",
                        help="抓取完整技能池（native/stone/blood，覆盖 pet_skills.json；约 11 分钟）")
    parser.add_argument("--skill-pools-limit", type=int, default=None,
                        help="技能池抓取上限精灵数（调试用，默认全部 671）")
    parser.add_argument("--items", action="store_true",
                        help="抓取道具图鉴（Category:道具，→ items.json；约 30 分钟）")
    parser.add_argument("--items-limit", type=int, default=None,
                        help="道具抓取上限页数（调试用，默认全部约 1780）")
    parser.add_argument("--quests", action="store_true",
                        help="抓取任务图鉴（Category:任务，→ quests.json；约 20 秒）")
    parser.add_argument("--marks", action="store_true",
                        help="抓取印记图鉴（总览页+独立页，→ marks.json；约 15 秒）")
    parser.add_argument("--map", action="store_true",
                        help="抓取地图点位（Data:MapV2，→ map_points.json；约 20 秒）")
    args = parser.parse_args(argv)

    # —— 活动抓取分支（独立于宠物数据主流程）——
    if args.activities:
        return _run_activities(args)

    # —— 技能池抓取分支（独立于宠物数据主流程）——
    if args.skill_pools:
        return _run_skill_pools(args)

    # —— 道具抓取分支（独立于宠物数据主流程）——
    if args.items:
        return _run_items(args)

    # —— 任务抓取分支（独立于宠物数据主流程）——
    if args.quests:
        return _run_quests(args)

    # —— 印记抓取分支（独立于宠物数据主流程）——
    if args.marks:
        return _run_marks(args)

    # —— 地图点位抓取分支（独立于宠物数据主流程）——
    if args.map:
        return _run_map(args)

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


def _run_skill_pools(args: argparse.Namespace) -> int:
    """抓取完整技能池（native/stone/blood），合并 feature，覆盖 pet_skills.json。

    数据源：每只精灵的页面级 wikitext ``{{精灵信息/兼容}}`` 模板参数（探路确认）。
    见 src/skill_pool_fetcher.py 文档。
    """
    if args.offline:
        print("[skill-pool] --skill-pools 不支持离线模式（需联网逐页抓取）")
        return 1

    seed_dir = args.seed_dir or settings.seed_dir
    pets_file = os.path.join(seed_dir, "pets.json")
    skills_file = os.path.join(seed_dir, "skills.json")
    for f in (pets_file, skills_file):
        if not os.path.isfile(f):
            print(f"[skill-pool] 缺少依赖文件：{f}（请先运行 python main.py 生成基础 seed）")
            return 1

    with open(pets_file, encoding="utf-8") as f:
        pets_items = json.load(f)["items"]
    with open(skills_file, encoding="utf-8") as f:
        skills_items = json.load(f)["items"]

    # 调试上限
    if args.skill_pools_limit:
        pets_items = pets_items[: args.skill_pools_limit]
        print(f"[skill-pool] 调试模式：仅处理前 {len(pets_items)} 只精灵")

    api = WikiApi()
    print(f"[skill-pool] 开始抓取 {len(pets_items)} 只精灵的技能池（QPS≤1，预计约 "
          f"{len(pets_items) // 60} 分钟）...")
    items, stats, distribution = fetch_skill_pools(api, pets_items, skills_items)

    print("[skill-pool] 抓取统计：")
    for k, v in stats.items():
        print(f"    {k:18s} {v}")

    if args.dry_run:
        print("[skill-pool] --dry-run，跳过写文件")
        return 0

    # 读取现有 pet_skills.json 的 meta 保留 source，覆盖 items
    out_path = os.path.join(seed_dir, "pet_skills.json")
    meta = {
        "source": settings.source_name,
        "source_url": settings.source_module_url,
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(items),
        "note": "feature 来自 Module:PetData/Core；native/stone/blood 来自页面级 {{精灵信息/兼容}} 模板",
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "items": items}, f, ensure_ascii=False, indent=2)
    print(f"[skill-pool] 已写出 {out_path}（{len(items)} 条，原先 671 条 feature-only）")

    # 同时写出 pet_locations.json（分布地区，多对多，复用同一次抓取）
    loc_items: list[dict] = []
    for slug, locs in distribution.items():
        for loc in locs:
            loc_items.append({"pet_slug": slug, "location": loc})
    loc_path = os.path.join(seed_dir, "pet_locations.json")
    loc_meta = {
        "source": settings.source_name,
        "source_url": settings.source_module_url,
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(loc_items),
        "note": "来自页面级 {{精灵信息/兼容}} 模板的「分布地区」字段，/ 分隔",
    }
    with open(loc_path, "w", encoding="utf-8") as f:
        json.dump({"meta": loc_meta, "items": loc_items}, f, ensure_ascii=False, indent=2)
    unique_locs = len({it["location"] for it in loc_items})
    print(f"[skill-pool] 已写出 {loc_path}（{len(loc_items)} 条关联，{len(distribution)} 只精灵，{unique_locs} 个地名）")
    return 0


def _run_items(args: argparse.Namespace) -> int:
    """抓取道具图鉴（Category:道具），写出 items.json。

    数据源：每只道具页面的 ``{{物品信息|...}}`` 模板参数（调研确认 1780 页）。
    见 src/item_fetcher.py 文档。
    """
    if args.offline:
        print("[item] --items 不支持离线模式（需联网逐页抓取）")
        return 1

    api = WikiApi()
    print(f"[item] 开始抓取道具图鉴（QPS≤1，预计约 30 分钟）...")
    items, stats = fetch_items(api, limit=args.items_limit)

    print("[item] 抓取统计：")
    for k, v in stats.items():
        print(f"    {k:14s} {v}")

    if args.dry_run:
        print("[item] --dry-run，跳过写文件")
        return 0

    out_dir = args.seed_dir or settings.seed_dir
    os.makedirs(out_dir, exist_ok=True)
    payload = {
        "meta": {
            "source": settings.source_name,
            "source_url": settings.source_module_url,
            "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(items),
            "note": "来自 Category:道具 页面级 {{物品信息}} 模板",
        },
        "items": items,
    }
    path = os.path.join(out_dir, "items.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[item] 已写出 {path}（{len(items)} 条道具）")
    return 0


def _run_quests(args: argparse.Namespace) -> int:
    """抓取任务图鉴（Category:任务），写出 quests.json。

    数据源：任务页面的 ``{{任务信息|...}}`` 模板参数（调研确认 18 页）。
    见 src/quest_fetcher.py 文档。
    """
    if args.offline:
        print("[quest] --quests 不支持离线模式（需联网逐页抓取）")
        return 1

    api = WikiApi()
    print(f"[quest] 开始抓取任务图鉴...")
    items, stats = fetch_quests(api)

    print("[quest] 抓取统计：")
    for k, v in stats.items():
        print(f"    {k:14s} {v}")

    if args.dry_run:
        print("[quest] --dry-run，跳过写文件")
        return 0

    out_dir = args.seed_dir or settings.seed_dir
    os.makedirs(out_dir, exist_ok=True)
    payload = {
        "meta": {
            "source": settings.source_name,
            "source_url": settings.source_module_url,
            "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(items),
            "note": "来自 Category:任务 页面级 {{任务信息}} 模板",
        },
        "items": items,
    }
    path = os.path.join(out_dir, "quests.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[quest] 已写出 {path}（{len(items)} 条任务）")
    return 0


def _run_marks(args: argparse.Namespace) -> int:
    """抓取印记图鉴（总览页 + 独立页合并），写出 marks.json。

    数据源：「印记」总览页（权威清单+阵营）+ 各印记独立页（机制/技能）。
    见 src/mark_fetcher.py 文档。⚠️ 不按标题搜索（避开道具重名陷阱）。
    """
    if args.offline:
        print("[mark] --marks 不支持离线模式（需联网抓取）")
        return 1

    api = WikiApi()
    print(f"[mark] 开始抓取印记图鉴...")
    items, stats = fetch_marks(api)

    print("[mark] 抓取统计：")
    for k, v in stats.items():
        print(f"    {k:14s} {v}")

    if args.dry_run:
        print("[mark] --dry-run，跳过写文件")
        return 0

    out_dir = args.seed_dir or settings.seed_dir
    os.makedirs(out_dir, exist_ok=True)
    payload = {
        "meta": {
            "source": settings.source_name,
            "source_url": settings.source_module_url,
            "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(items),
            "note": "来自「印记」总览页（权威清单+阵营）+ 各独立页（机制/可施加技能）",
        },
        "items": items,
    }
    path = os.path.join(out_dir, "marks.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[mark] 已写出 {path}（{len(items)} 条印记）")
    return 0


def _run_map(args: argparse.Namespace) -> int:
    """抓取地图点位 + 文字图层（Data:Mapnew），写出 map_points.json。

    数据源：Data:Mapnew/type/{id}/json 坐标 + textLayer 地名（与 BWIKI「大地图」同源）。
    见 src/map_fetcher.py 文档。前端用 Leaflet + BWIKI 瓦片底图渲染。
    """
    if args.offline:
        print("[map] --map 不支持离线模式（需联网抓取）")
        return 1

    api = WikiApi()
    print(f"[map] 开始抓取地图点位（Data:Mapnew，约 3 分钟）...")
    items, text_layers, stats = fetch_map_points(api)

    print("[map] 抓取统计：")
    for k, v in stats.items():
        print(f"    {k:14s} {v}")

    if args.dry_run:
        print("[map] --dry-run，跳过写文件")
        return 0

    out_dir = args.seed_dir or settings.seed_dir
    os.makedirs(out_dir, exist_ok=True)
    payload = {
        "meta": {
            "source": settings.source_name,
            "source_url": settings.source_module_url,
            "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "count": len(items),
            "note": "来自 Data:Mapnew 点位坐标 + textLayer 地名（与 BWIKI 大地图同源，游戏内坐标系）",
        },
        "items": items,
        "text_layers": text_layers,
    }
    path = os.path.join(out_dir, "map_points.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[map] 已写出 {path}（{len(items)} 个点位，{len(text_layers)} 个地名）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
