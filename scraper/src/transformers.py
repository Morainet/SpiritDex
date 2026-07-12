"""把原始 Lua 数据（RawData）加工为 seed JSON 结构（items 列表）。

字段映射决策（见 doc/implementation-plan.md §4.3 与决策记录）：
- slug：精灵 ``pet-{dex_no:04d}``、技能 ``skill-{id:04d}``（稳定、唯一、与 ID 对齐）
- 属性：中文 name（"草"）+ 拼音 slug（"cao"）；属性系别后缀「系」去掉
- 种族值：Core 的 ``st={at,df,hp,sa,sd,se}`` → base_stats{hp,atk,def,spa,sdf,spe}
- pet_skill：模块中仅有 feature_skill(fs)，每只精灵 1 条；完整技能池（native/stone/blood
  + 解锁等级）不在模块中，需后续 page-wikitext 抓取，本 Phase 暂不覆盖
"""

from __future__ import annotations

from typing import Any

from .api import WikiApi
from .fetcher import RawData

# 18 个属性枚举（BWIKI Module:DexIndex TYPE_ORDER），去掉「系」字后入库
# 顺序固定，作为 type.sort_order
_TYPES_IN_ORDER = [
    "普通", "草", "火", "水", "光", "地", "冰", "龙", "电",
    "毒", "虫", "武", "翼", "萌", "幽", "恶", "机械", "幻",
]

# 中文属性 → 拼音 slug。游戏术语常用映射，覆盖 18 枚举。
_TYPE_PINYIN = {
    "普通": "normal", "草": "grass", "火": "fire", "水": "water",
    "光": "light", "地": "ground", "冰": "ice", "龙": "dragon",
    "电": "electric", "毒": "poison", "虫": "bug", "武": "fighting",
    "翼": "flying", "萌": "cute", "幽": "ghost", "恶": "dark",
    "机械": "machine", "幻": "illusion",
}

# Core 模块 key 缩写 → 可读名（_meta.key 的子集，便于阅读/调试）
_STAT_KEY = {"hp": "hp", "at": "atk", "df": "def", "sa": "spa", "sd": "sdf", "se": "spe"}


def _num(s: str) -> int:
    """``pet_000001`` -> 1。"""
    return int(s.rsplit("_", 1)[-1])


def _normalize_type(raw: str) -> str | None:
    """``草系`` -> ``草``；未知则返回 None。"""
    if not raw:
        return None
    return raw[:-1] if raw.endswith("系") else raw


def build_types() -> list[dict]:
    """生成 18 个属性枚举（来自固定 TYPE_ORDER，非抓取）。"""
    return [
        {
            "slug": _TYPE_PINYIN[name],
            "name": name,
            "name_en": _TYPE_PINYIN[name],
            "sort_order": i,
            "source": "BWIKI Module:DexIndex TYPE_ORDER",
        }
        for i, name in enumerate(_TYPES_IN_ORDER)
    ]


def build_skills(raw: RawData) -> list[dict]:
    """SkillCatalog -> skill items。

    SkillCatalog key：category / desc / element / energy / icon_id / id / name /
    target，部分含 power / damage_class / flavor。
    element 形如 ``无系别`` / ``草系``：去掉「系别」尾缀得到「无」「草」。
    """
    items = []
    for key, sk in raw.skills.items():
        if not isinstance(sk, dict):
            continue
        catalog_id = key  # skill_000001（连续稳定的目录编号）
        catalog_num = _num(catalog_id)  # 1
        items.append({
            "slug": f"skill-{catalog_num:04d}",
            "catalog_id": catalog_id,
            "catalog_num": catalog_num,
            "name": sk.get("name", ""),
            "category": sk.get("category"),
            "element": _normalize_element(sk.get("element")),
            "power": sk.get("power"),
            "damage_class": sk.get("damage_class"),
            "energy": sk.get("energy"),
            "target": sk.get("target"),
            "effect_text": sk.get("desc"),
            "flavor_text": sk.get("flavor"),
            "icon_id": str(sk["icon_id"]) if sk.get("icon_id") is not None else None,
            "source_url": raw.source_url,
        })
    items.sort(key=lambda x: x["catalog_num"])
    return items


def _normalize_element(raw: str | None) -> str | None:
    """``无系别``->``无``、``草系``->``草``、``无``->``无``。"""
    if not raw:
        return None
    s = raw
    for suf in ("系别", "系"):
        if s.endswith(suf):
            s = s[: -len(suf)]
            break
    return s or None


def build_pets(raw: RawData) -> tuple[list[dict], list[dict], list[dict]]:
    """Core(+Handbook) -> (pets, pet_types, pet_skills)。

    返回三个列表：
    - pets：精灵主记录
    - pet_types：精灵↔属性关联（带 slot 主/副）
    - pet_skills：精灵↔特性技能关联（每只 1 条，learn_method=feature）
    """
    pets, pet_types, pet_skills = [], [], []
    for key, pet in sorted(raw.core.items()):
        if not isinstance(pet, dict) or not key.startswith("pet_"):
            continue  # 跳过 _meta 等非宠物条目
        dex_no = _num(pet.get("i", key))  # i = "pet_000001"
        slug = f"pet-{dex_no:04d}"
        name = pet.get("n", "")

        # base_stats
        st = pet.get("st") or {}
        base_stats = {_STAT_KEY[k]: st[k] for k in _STAT_KEY if k in st} or None

        # 图鉴补充（Handbook）：描述/栖息地更优来源之一，但 Core 已有 d；habitat 取 Handbook
        hb_id = (pet.get("hb") or {}).get("i")
        handbook = raw.handbook.get(hb_id, {}) if isinstance(hb_id, str) else {}
        habitat = handbook.get("habitat") if isinstance(handbook, dict) else None

        pets.append({
            "slug": slug,
            "dex_no": dex_no,
            "catalog_id": key,                 # pet_000001
            "name": name,
            "title": pet.get("t"),             # 头衔/称号
            "description": pet.get("d"),
            "category": pet.get("c"),          # 猫咪类精灵 / 自然类精灵 ...
            "stage": pet.get("sg"),            # 1/2/3 阶
            "types": [_normalize_type(t) for t in (pet.get("tp") or []) if t],
            "base_stats": base_stats,
            "height": pet.get("ht"),
            "weight": pet.get("wt"),
            "can_double_ride": pet.get("dr"),
            "has_shiny": pet.get("hs"),        # 异色
            "feature_skill_id": pet.get("fs"), # skill_000003
            "illustration_key": (pet.get("img") or {}).get("il"),
            "head_key": (pet.get("img") or {}).get("hd"),
            "egg_key": (pet.get("img") or {}).get("eg"),
            "handbook_id": hb_id,
            "habitat": habitat,
            "evolution_group_id": (pet.get("evg") or [None])[0],  # evo_000004
            "source_url": raw.source_url,
        })

        # pet_type 关联（主属性 slot=1，副 slot=2）
        for slot, type_name in enumerate(pets[-1]["types"], start=1):
            slug_t = _TYPE_PINYIN.get(type_name)
            if not slug_t:
                continue
            pet_types.append({"pet_slug": slug, "type_slug": slug_t, "slot": slot})

        # pet_skill：仅 feature_skill（模块中唯一的 pet→skill 关系）
        fs = pet.get("fs")
        if isinstance(fs, str) and fs.startswith("skill_"):
            pet_skills.append({
                "pet_slug": slug,
                "skill_catalog_id": fs,
                "learn_method": "feature",
                "unlock_level": None,
            })
    return pets, pet_types, pet_skills


def build_evolutions(raw: RawData) -> tuple[list[dict], list[dict]]:
    """Evolution -> (evolution_chains, evolution_stages)。"""
    chains, stages = [], []
    for key, evo in sorted(raw.evolutions.items()):
        if not isinstance(evo, dict):
            continue
        chain = evo.get("chain") or []
        chains.append({
            "group_id": key,                  # evo_000001
            "name": evo.get("name"),
            "stage_count": len(chain),
            "source_url": raw.source_url,
        })
        for st in chain:
            if not isinstance(st, dict):
                continue
            pet_ref = st.get("id")            # pet_000002
            stages.append({
                "group_id": key,
                "stage_no": st.get("stage"),
                "pet_catalog_id": pet_ref,
                "pet_name": st.get("name"),
                "pet_title": st.get("title"),
                "level": st.get("level"),     # 进化所需等级（首阶无）
                "cond": st.get("cond"),       # 进化条件（部分非等级进化）
                "form": st.get("form"),
                "types": [_normalize_type(t) for t in (st.get("types") or []) if t],
                "head_key": st.get("head"),
                "illustration_key": st.get("illustration"),
            })
    return chains, stages


def build_type_effectiveness(raw: RawData) -> list[dict]:
    """属性相克矩阵（从 BWIKI Widget:RestrainCalc.js 抓取）。

    输出 slug 形式（attacking_type/defending_type 为拼音 slug，如 grass/fire），
    与 SeedRunner 的 slug→id 解析对齐。仅记录非 1.0 的条目。
    raw.type_chart_pairs 为 [(攻击方中文, 防御方中文, multiplier)]。
    """
    items = []
    for atk_cn, def_cn, mult in raw.type_chart_pairs:
        atk_slug = _TYPE_PINYIN.get(atk_cn)
        def_slug = _TYPE_PINYIN.get(def_cn)
        if not atk_slug or not def_slug:
            continue  # 未知属性（如「无」），跳过
        items.append({
            "attacking_type": atk_slug,
            "defending_type": def_slug,
            "multiplier": mult,
            "source_url": raw.source_url,
        })
    return items


def build_articles() -> list[dict]:
    """攻略文章（静态示例）。

    非抓取产物——文章正文为人工编写，Markdown 格式入库，前端 react-markdown 渲染。
    后续真实文章可在 data/seed/articles.json 直接增补，或 Phase 7 上线后台后改走 CMS。
    """
    return [
        {
            "slug": "beginners-guide",
            "title": "新手入门指南：从零开始的精灵训练师之路",
            "summary": "刚进入洛克王国手游世界？本篇带你了解属性克制、初始精灵选择、进化机制与日常玩法，快速上手。",
            "category": "新手",
            "tags": ["新手", "入门", "基础"],
            "author_name": "灵宠档案编辑部",
            "status": "published",
            "cover_image": None,
            "content": BEGINNERS_GUIDE_MD,
        },
    ]


# 示例文章正文（Markdown）。演示标题/列表/加粗/引用/分隔线等基础语法。
BEGINNERS_GUIDE_MD = """# 新手入门指南

欢迎来到**洛克王国手游**的世界！本篇帮助你快速理解游戏核心机制，迈出成为优秀精灵训练师的第一步。

## 一、属性克制是核心

洛克王国的战斗围绕 **18 种属性**的克制关系展开。掌握相克表，能让你在对战中占据先机：

- **草** 克制 **水**，水克制火，火克制草——经典的三角循环。
- 每只精灵可有一到两个属性，双属性精灵的克制关系会叠加计算。
- 完整的属性相克矩阵，可在本站 [属性相克表](/types/matrix) 页面查看。

> 小贴士：进入新区域前，先看看当地野生精灵的属性，带上克制的队伍会轻松很多。

## 二、初始精灵怎么选

御三家（喵喵 / 水蓝蓝 / 火花）是大多数玩家的起点，它们分别对应草、水、火三系：

| 精灵 | 属性 | 特点 |
|------|------|------|
| 喵喵 | 草 | 防御扎实，魔防突出，适合稳健型玩家 |
| 水蓝蓝 | 水 | 血量成长高，续航能力强 |
| 火花 | 火 | 攻击激进，输出爆发高 |

**没有绝对的最强**，选择自己喜欢的就好——毕竟要一起冒险很久。

## 三、进化机制

精灵通过**提升等级**可以进化到更高阶形态，能力大幅增长：

1. 一阶精灵达到指定等级后进化为二阶；
2. 部分精灵可进一步进化为三阶（最终形态）；
3. 少数精灵有特殊进化条件（如道具、亲密度）。

每只精灵的进化链，都可以在它的**详情页**查看完整进化路线。

## 四、日常建议

- 每天记得完成**图鉴课题**，奖励丰厚。
- 多捕捉不同属性的精灵，丰富你的图鉴与队伍搭配。
- 善用本站的**精灵图鉴**查阅种族值、**技能库**了解技能效果。

---

祝你冒险愉快！遇到问题可以反复查阅本指南，或探索图鉴里的其他精灵。
"""


def transform(raw: RawData) -> dict[str, list[dict]]:
    """汇总：返回所有 seed 文件的 items，键为文件名（不含 .json）。"""
    types = build_types()
    skills = build_skills(raw)
    pets, pet_types, pet_skills = build_pets(raw)
    chains, stages = build_evolutions(raw)
    type_effectiveness = build_type_effectiveness(raw)
    articles = build_articles()
    return {
        "types": types,
        "skills": skills,
        "pets": pets,
        "pet_types": pet_types,
        "pet_skills": pet_skills,
        "evolution_chains": chains,
        "evolution_stages": stages,
        "type_effectiveness": type_effectiveness,
        "articles": articles,
    }
