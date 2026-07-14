"""印记图鉴抓取器：从 BWIKI「印记」总览页 + 独立页提取战斗印记信息。

数据源（调研确认，与其他图鉴不同——双数据源合并）：
1. **总览页**（``印记``）：权威清单（13 个），提供阵营标签（正面/负面）+ 兜底效果描述
2. **独立页**（如 ``龙噬印记``）：补充机制说明、可施加技能列表（10 个有独立页，3 个无）

⚠️ 重名陷阱：BWIKI 有「帕尔印记/命定印记/传说印记」等**道具**（用 {{物品信息}} 模板），
名字带「印记」但**不是战斗印记**。**绝不能按标题搜索**，必须只从总览页的 ``[[xxx]]``
链接清单提取权威来源（正好排除所有道具重名）。

总览页结构::

    === 正面印记 ===
    * [[湿润印记]]：全技能能耗-1。
    * [[龙噬印记]]：释放3能耗技能时，获得双攻+30%，可叠加。
    ...
    === 负面印记 ===
    * [[减速印记]]：速度-10。
    ...

独立页结构（wikitext，非模板）::

    == 印记名 ==
    === 基础效果 ===
    * 效果描述：...
    === 机制说明 ===
    * ...
    === 可施加该印记的技能 ===
    * [[技能名]]：...

字段映射：name / faction(正面/负面) / effect_text / mechanics / source_skills(列表)
"""

from __future__ import annotations

import re

from .api import WikiApi

# 总览页段落标题 → 阵营标签
_FACTION_HEADERS = {
    "正面印记": "正面",
    "负面印记": "负面",
}


def fetch_marks(api: WikiApi) -> tuple[list[dict], dict]:
    """抓取印记图鉴（总览页 + 独立页合并）。返回 (items, stats)。"""
    print("[mark] 抓取「印记」总览页...")
    overview = api.fetch_module_wikitext("印记")
    roster = _parse_overview(overview)  # [(name, faction, fallback_effect), ...]
    print(f"[mark] 总览页解析出 {len(roster)} 个印记（正面{sum(1 for r in roster if r[1]=='正面')} / 负面{sum(1 for r in roster if r[1]=='负面')}）")

    items: list[dict] = []
    has_detail = no_detail = 0
    for name, faction, fallback_effect in roster:
        num = len(items) + 1
        item: dict = {
            "slug": f"mark-{num:04d}",
            "catalog_id": name,
            "name": name,
            "faction": faction,
            "effect_text": fallback_effect,  # 默认用总览页描述，独立页有则覆盖
            "source_url": api.page_url(name),
        }
        # 尝试抓独立页补充详情
        try:
            detail_text = api.fetch_module_wikitext(name)
            detail = _parse_detail(detail_text)
            if detail.get("effect"):
                item["effect_text"] = detail["effect"]
            if detail.get("mechanics"):
                item["mechanics"] = detail["mechanics"]
            if detail.get("source_skills"):
                item["source_skills"] = detail["source_skills"]
            has_detail += 1
        except Exception as ex:  # noqa: BLE001 —— 无独立页用总览页兜底
            no_detail += 1
            print(f"[mark]   {name} 无独立页，用总览页描述兜底")
        items.append(item)

    # 按阵营（正面在前）+ 名称排序
    items.sort(key=lambda x: (0 if x.get("faction") == "正面" else 1, x["name"]))
    # 重排 slug 保持稳定
    for i, it in enumerate(items, start=1):
        it["slug"] = f"mark-{i:04d}"

    stats = {"total": len(items), "has_detail": has_detail, "no_detail": no_detail}
    return items, stats


def _parse_overview(overview: str) -> list[tuple[str, str, str]]:
    """解析总览页，返回 [(name, faction, fallback_effect), ...]。

    按 ``=== 正面/负面印记 ===`` 段落分组，每行 ``* [[印记名]]：效果`` 提取。
    """
    roster: list[tuple[str, str, str]] = []
    current_faction: str | None = None
    for line in overview.splitlines():
        # 检测阵营段落标题
        header_m = re.match(r"^===\s*(.+?)\s*===", line)
        if header_m:
            title = header_m.group(1).strip()
            current_faction = _FACTION_HEADERS.get(title)
            continue
        if current_faction is None:
            continue
        # 匹配 * [[印记名]]：效果描述
        item_m = re.match(r"^\*\s*\[\[([^\]]+)\]\]\s*[：:](.*)", line)
        if item_m:
            name = item_m.group(1).strip()
            effect = item_m.group(2).strip()
            roster.append((name, current_faction, effect))
    return roster


def _parse_detail(text: str) -> dict:
    """解析独立印记页，提取 effect / mechanics / source_skills。

    独立页用 ``=== 段落 ===`` 分节，每节内是 ``* 内容`` 列表。
    """
    result: dict = {"effect": None, "mechanics": None, "source_skills": []}
    # 按段落标题切分
    sections = re.split(r"^===\s*(.+?)\s*===", text, flags=re.MULTILINE)
    # sections: [前导, 标题1, 内容1, 标题2, 内容2, ...]
    current = None
    for i, part in enumerate(sections):
        if i % 2 == 1:  # 标题
            current = part.strip()
        else:  # 内容
            if current is None:
                continue
            bullets = [ln.lstrip("* ").strip() for ln in part.splitlines() if ln.strip().startswith("*")]
            bullets = [b for b in bullets if b]
            if current == "基础效果":
                # 取「效果描述：xxx」的值
                for b in bullets:
                    if b.startswith("效果描述"):
                        result["effect"] = b.split("：", 1)[-1].strip() if "：" in b else b.split(":", 1)[-1].strip()
                        break
                if not result["effect"] and bullets:
                    result["effect"] = bullets[0]
            elif current == "机制说明":
                result["mechanics"] = "\n".join(bullets) if bullets else None
            elif current == "可施加该印记的技能":
                # 提取 [[技能名]]：说明
                for b in bullets:
                    sk_m = re.match(r"\[\[([^\]]+)\]\]\s*[：:]?(.*)", b)
                    if sk_m:
                        sk_name = sk_m.group(1).strip()
                        sk_desc = sk_m.group(2).strip().lstrip("：:").strip()
                        result["source_skills"].append(
                            {"name": sk_name, "desc": sk_desc} if sk_desc else {"name": sk_name}
                        )
    return result
