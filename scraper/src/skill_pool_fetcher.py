"""精灵技能池抓取器：从 BWIKI 精灵页面级 wikitext 提取 native/stone/blood 技能。

数据源（探路确认）：每只精灵的独立 wiki 页面（如 ``https://wiki.biligame.com/rocom/喵喵``），
页面内 ``{{精灵信息/兼容|...}}`` 模板参数携带完整技能池：

================  ================  ===========================
模板参数          learn_method       示例（喵喵）
================  ================  ===========================
``特性``          ``feature``        氧循环
``技能``          ``native``         抓挠,休息回复,棘突,...(16个，升级学习)
``技能解锁等级``    native 的等级      1,1,6,7,8,10,...(与「技能」位置一一对应)
``血脉技能``       ``blood``          星星撞击,贪婪,...(18个)
``可学技能石``     ``stone``          借用,剧毒,...(16个)
================  ================  ===========================

技能以中文名形式给出，需用 SkillCatalog 建索引匹配回 ``catalog_id``（探路实测命中率 100%）。

产物：与现有 ``pet_skills.json`` 同构的 items 列表（可合并/覆盖），结构::

    [{"pet_slug", "skill_catalog_id", "learn_method", "unlock_level"}]

合规：复用 ``WikiApi``（QPS≤1、UA、POST 绕 WAF）；671 页 × 1s ≈ 11 分钟；
按 page name 去重抓取（同名不同形态的精灵共用一份，首轮实现；形态差异后续优化）。
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field

from .api import WikiApi


# 模板参数名 → learn_method（探路实测的稳定映射）
_FIELD_TO_METHOD = [
    ("技能", "native"),
    ("血脉技能", "blood"),
    ("可学技能石", "stone"),
]


@dataclass
class SkillPool:
    """单只精灵解析后的技能池（catalog_id 已解析）。"""

    pet_slug: str
    feature: list[tuple[str, None]] = field(default_factory=list)        # [(catalog_id, None)]
    native: list[tuple[str, int | None]] = field(default_factory=list)  # [(catalog_id, level)]
    blood: list[tuple[str, None]] = field(default_factory=list)
    stone: list[tuple[str, None]] = field(default_factory=list)

    def to_items(self) -> list[dict]:
        """展平为 pet_skills.json 同构 items。"""
        out: list[dict] = []
        for method, pairs in (
            ("feature", self.feature),
            ("native", self.native),
            ("blood", self.blood),
            ("stone", self.stone),
        ):
            for catalog_id, level in pairs:
                out.append({
                    "pet_slug": self.pet_slug,
                    "skill_catalog_id": catalog_id,
                    "learn_method": method,
                    "unlock_level": level,
                })
        return out


def build_name_index(skills_items: list[dict]) -> dict[str, str]:
    """从 skills.json items 建 ``技能名 -> catalog_id`` 索引。

    重名技能取第一条（SkillCatalog 基本无重名，探路实测 737 条去重后 730）。
    """
    idx: dict[str, str] = {}
    for sk in skills_items:
        name = sk.get("name")
        catalog_id = sk.get("catalog_id")
        if name and catalog_id and name not in idx:
            idx[name] = catalog_id
    return idx


def parse_skill_pool(
    wikitext: str,
    pet_slug: str,
    name_to_catalog: dict[str, str],
) -> SkillPool | None:
    """解析单只精灵页面 wikitext，返回 SkillPool（无 ``{{精灵信息}}`` 模板则 None）。

    鲁棒性：模板缺失/字段空/技能名未命中均不抛异常，仅跳过对应条目。
    """
    params = _extract_template_params(wikitext)
    if params is None:
        return None  # 非「精灵信息/兼容」页面（如重定向、空页）

    pool = SkillPool(pet_slug=pet_slug)
    seen_native: set[str] = set()

    # native：技能名列表 + 等级列表（位置一一对应）
    # 去重：BWIKI「技能」字段偶有重复（如牵线木偶的借用/取念/复写列 4 次，疑似形态变体笔误）
    native_names = _split_csv(params.get("技能"))
    native_levels = _split_csv(params.get("技能解锁等级"))
    for i, skill_name in enumerate(native_names):
        catalog_id = name_to_catalog.get(skill_name)
        if not catalog_id or catalog_id in seen_native:
            continue
        seen_native.add(catalog_id)
        level = _to_int(native_levels[i]) if i < len(native_levels) else None
        pool.native.append((catalog_id, level))

    # blood / stone：仅技能名（各自去重）
    for field_name, method in _FIELD_TO_METHOD[1:]:  # 跳过 native（已处理）
        seen: set[str] = set()
        for skill_name in _split_csv(params.get(field_name)):
            catalog_id = name_to_catalog.get(skill_name)
            if catalog_id and catalog_id not in seen:
                seen.add(catalog_id)
                getattr(pool, method).append((catalog_id, None))

    return pool


def fetch_skill_pools(
    api: WikiApi,
    pets_items: list[dict],
    skills_items: list[dict],
    *,
    progress_every: int = 50,
) -> tuple[list[dict], dict]:
    """抓取所有精灵的技能池。

    返回 ``(items, stats)``：
    - items：合并后的 pet_skill 记录（含 feature + native/blood/stone）
    - stats：统计字典（命中率、抓取失败数等）

    按 page name 去重抓取（同名精灵共用一份技能池）。
    feature 技能保留自原 ``pets_items``（确保不丢已有特性关联）。
    """
    name_to_catalog = build_name_index(skills_items)
    print(f"[skill-pool] SkillCatalog 索引: {len(name_to_catalog)} 个技能名")

    # 缓存：page_name(中文) -> SkillPool（同名精灵共用）
    page_cache: dict[str, SkillPool] = {}
    fetch_ok = fetch_fail = 0

    # 先按 name 去重，确定要抓的页面（保留 name -> 首个 pet_slug 便于缓存命中展示）
    pets_by_name: dict[str, list[dict]] = {}
    for pet in pets_items:
        pets_by_name.setdefault(pet["name"], []).append(pet)
    unique_names = list(pets_by_name.keys())
    total = len(unique_names)
    print(f"[skill-pool] 唯一精灵名 {total} 个（去重前 {len(pets_items)}），开始抓取...")

    for i, name in enumerate(unique_names, start=1):
        try:
            wikitext = api.fetch_module_wikitext(name)
            # 用首个 pet_slug 解析（技能池内容与 slug 无关，仅用于 to_items 时替换）
            first_slug = pets_by_name[name][0]["slug"]
            pool = parse_skill_pool(wikitext, first_slug, name_to_catalog)
            if pool is not None:
                page_cache[name] = pool
                fetch_ok += 1
            else:
                # 页面存在但无模板，记为解析失败
                fetch_fail += 1
        except Exception as ex:  # noqa: BLE001 —— 单页失败不阻断整体
            fetch_fail += 1
            if i <= 5 or i % 100 == 0:
                print(f"[skill-pool]   {name} 抓取失败: {ex}")

        if i % progress_every == 0 or i == total:
            print(f"[skill-pool]   进度 {i}/{total}（成功 {fetch_ok}，失败 {fetch_fail}）")

    # 展开为所有精灵的 pet_skill 记录（同名精灵各自生成一份）
    all_items: list[dict] = []
    pets_with_pool = 0
    for pet in pets_items:
        slug = pet["slug"]
        pool = page_cache.get(pet["name"])
        # feature：始终从 catalog_id 取，保证不丢
        feature_id = pet.get("feature_skill_id")
        if isinstance(feature_id, str) and feature_id.startswith("skill_"):
            all_items.append({
                "pet_slug": slug,
                "skill_catalog_id": feature_id,
                "learn_method": "feature",
                "unlock_level": None,
            })
        if pool is None:
            continue
        # 复用解析结果，但替换 pet_slug
        for method, pairs in (
            ("native", pool.native),
            ("blood", pool.blood),
            ("stone", pool.stone),
        ):
            for catalog_id, level in pairs:
                all_items.append({
                    "pet_slug": slug,
                    "skill_catalog_id": catalog_id,
                    "learn_method": method,
                    "unlock_level": level,
                })
        pets_with_pool += 1

    # 全局去重：同一 (pet, skill) 跨 method 可能重复（如某技能既能 native 学也能 stone 学）。
    # pet_skill 表有 UNIQUE(pet_id, skill_id) 约束，冲突时保留信息量大的：
    # native（带等级）> blood/stone（无等级）。
    method_priority = {"native": 0, "blood": 1, "stone": 2, "feature": 3}
    best: dict[tuple[str, str], dict] = {}
    for it in all_items:
        key = (it["pet_slug"], it["skill_catalog_id"])
        cur = best.get(key)
        if cur is None or method_priority.get(it["learn_method"], 9) < method_priority.get(cur["learn_method"], 9):
            best[key] = it
    deduped = list(best.values())
    if len(deduped) < len(all_items):
        print(f"[skill-pool] 跨 method 去重: {len(all_items)} -> {len(deduped)}（移除 {len(all_items) - len(deduped)} 条冲突）")

    stats = {
        "total_pets": len(pets_items),
        "unique_pages": total,
        "fetch_ok": fetch_ok,
        "fetch_fail": fetch_fail,
        "pets_with_pool": pets_with_pool,
        "skill_records": len(deduped),
    }
    return deduped, stats


# ====== 内部工具 ======

# 页面内「精灵信息/兼容」模板的简单参数解析
_PARAM_RE = re.compile(r"^\s*\|([^=]+?)=(.*)$")


def _extract_template_params(wikitext: str) -> dict[str, str] | None:
    """提取 ``{{精灵信息/兼容|...}}`` 模板的命名参数。

    实现策略（探路确认页面结构规整）：逐行扫描，遇到 ``|key=value`` 累计，
    直到模板闭合 ``}}``。不处理嵌套模板（该模板参数均为纯文本）。

    返回参数 dict；若无 ``精灵信息`` 模板返回 None。
    """
    # 定位模板起点：{{精灵信息/兼容 或 {{精灵信息（兼容前缀）
    start = wikitext.find("{{精灵信息")
    if start == -1:
        return None
    # 从起点扫描到 }}，按行收集 |key=value
    params: dict[str, str] = {}
    body = wikitext[start:]
    # 找第一个 }} 作为模板结束（参数值内一般不含 }}）
    end = body.find("}}")
    if end != -1:
        body = body[:end]
    for line in body.splitlines():
        m = _PARAM_RE.match(line)
        if m:
            params[m.group(1).strip()] = m.group(2).strip()
    return params if params else None


def _split_csv(raw: str | None) -> list[str]:
    """``"a,b,c"`` -> ``["a","b","c"]``；空/``-`` -> ``[]``。"""
    if not raw or not raw.strip() or raw.strip() == "-":
        return []
    return [x.strip() for x in raw.split(",") if x.strip()]


def _to_int(s: str | None) -> int | None:
    """安全转 int。"""
    if not s:
        return None
    try:
        return int(s.strip())
    except (ValueError, AttributeError):
        return None
