"""探路脚本：实测 BWIKI 精灵页面级 wikitext 里的技能池数据结构。

目的：搞清 native/stone/blood 技能 + 解锁等级到底在页面的哪个位置、什么格式，
为后续写 skill_pool_fetcher 解析器提供地基。

复用 src.api.WikiApi.fetch_module_wikitext（已支持任意 page 名，POST 绕 WAF）。

用法::

    python scripts/probe_pet_skills.py
    python scripts/probe_pet_skills.py --pets 喵喵 水蓝蓝
    python scripts/probe_pet_skills.py --save   # 把原始 wikitext 存到 tests/fixtures/

不写任何 seed 数据，只打印分析 + 可选存档原始页面。
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter

# 支持直接 python scripts/probe_pet_skills.py 运行
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
sys.path.insert(0, _ROOT)

from src.api import WikiApi  # noqa: E402

# 关注的关键字（技能池相关）
KEYWORDS = ["技能", "skill", "Skill", "秘籍", "血脉", "天赋", "等级", "解锁",
            "学习", "native", "stone", "blood", "特性", "招式", "资质"]


def analyze(name: str, text: str) -> None:
    """打印一只精灵页面 wikitext 的结构分析。"""
    print(f"\n{'=' * 70}")
    print(f"页面：【{name}】  长度 {len(text)} 字符")
    print('=' * 70)

    # 1. 关键字命中
    print("\n[1] 关键字命中：")
    hits = {kw: text.count(kw) for kw in KEYWORDS if text.count(kw) > 0}
    if hits:
        for kw, n in hits.items():
            print(f"    {kw!r:12s} × {n}")
    else:
        print("    （无命中）")

    # 2. 所有 {{模板调用}} 统计（抓顶层模板名）
    print("\n[2] 模板调用（{{...}} 顶层名）：")
    templates = re.findall(r"{{\s*([^|{}\n]+?)\s*[|}]", text)
    tpl_counter = Counter(templates)
    if tpl_counter:
        for tpl, n in tpl_counter.most_common(15):
            print(f"    {{<{tpl}>}} × {n}")
    else:
        print("    （无模板）")

    # 3. #invoke Lua 调用
    print("\n[3] #invoke 调用：")
    invokes = re.findall(r"{{\s*#invoke:\s*([^|}\n]+)", text)
    if invokes:
        for inv in invokes:
            print(f"    #invoke:{inv.strip()}")
    else:
        print("    （无）")

    # 4. 表格（{| ... |}）统计
    table_count = text.count("{|")
    print(f"\n[4] wiki 表格（{{|）数量：{table_count}")

    # 5. 前 2500 字符预览
    print("\n[5] wikitext 前 2500 字符预览：")
    print("-" * 70)
    print(text[:2500])
    if len(text) > 2500:
        print(f"...（省略 {len(text) - 2500} 字符）")
    print("-" * 70)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="探路：精灵页面技能池数据结构")
    parser.add_argument("--pets", nargs="*", default=["喵喵", "水蓝蓝", "火花"],
                        help="要抓取的精灵页面名（默认御三家）")
    parser.add_argument("--save", action="store_true",
                        help="把原始 wikitext 存到 tests/fixtures/page_<name>.txt")
    args = parser.parse_args(argv)

    api = WikiApi()
    fixture_dir = os.path.join(_ROOT, "tests", "fixtures")
    if args.save:
        os.makedirs(fixture_dir, exist_ok=True)

    for name in args.pets:
        try:
            text = api.fetch_module_wikitext(name)
        except Exception as ex:
            print(f"\n【{name}】抓取失败：{ex}")
            continue
        analyze(name, text)
        if args.save:
            safe = re.sub(r"[^\w\u4e00-\u9fff]", "_", name)
            path = os.path.join(fixture_dir, f"page_{safe}.txt")
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"\n[save] 已存档 → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
