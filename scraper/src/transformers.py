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
        {
            "slug": "mechanism-type-effectiveness",
            "title": "属性相克机制详解：18 属性矩阵与双属性叠加",
            "summary": "掌握属性相克是战斗的核心。本篇详解 18 属性的克制关系、双属性精灵的倍率叠加算法，以及实战中如何判断优劣。",
            "category": "机制",
            "tags": ["机制", "属性", "相克", "战斗"],
            "author_name": "灵宠档案编辑部",
            "status": "published",
            "cover_image": None,
            "content": MECHANISM_TYPE_EFFECTIVENESS_MD,
        },
        {
            "slug": "mechanism-nature",
            "title": "性格系统详解：30 种性格的属性增减与选择策略",
            "summary": "性格决定精灵六维的增减方向。本篇列出全部 30 种性格的效果，并按输出、肉盾、辅助等定位给出选择建议。",
            "category": "机制",
            "tags": ["机制", "性格", "培养"],
            "author_name": "灵宠档案编辑部",
            "status": "published",
            "cover_image": None,
            "content": MECHANISM_NATURE_MD,
        },
        {
            "slug": "mechanism-training",
            "title": "精灵培养指南：种族值、个体值与面板计算",
            "summary": "一只精灵强不强？本篇解析种族值、个体值、性格、阶段如何共同决定最终面板，帮你判断哪些精灵值得投入资源培养。",
            "category": "机制",
            "tags": ["机制", "培养", "种族值"],
            "author_name": "灵宠档案编辑部",
            "status": "published",
            "cover_image": None,
            "content": MECHANISM_TRAINING_MD,
        },
        {
            "slug": "mechanism-capture",
            "title": "捕捉机制详解：精灵球、概率与实战技巧",
            "summary": "怎么提高捕捉成功率？本篇讲解精灵球种类与加成、捕捉概率的影响因素，以及残血、异常状态等实战技巧。",
            "category": "机制",
            "tags": ["机制", "捕捉", "精灵球"],
            "author_name": "灵宠档案编辑部",
            "status": "published",
            "cover_image": None,
            "content": MECHANISM_CAPTURE_MD,
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


# ====== 机制知识库文章（category=机制）======

MECHANISM_TYPE_EFFECTIVENESS_MD = """# 属性相克机制详解

洛克王国手游的战斗核心是 **18 种属性**的相克关系。理解相克机制，是组建阵容、选择技能、判断对战优劣的基础。本站提供完整的[属性相克矩阵](/types/matrix)，本篇讲解其背后的原理。

## 一、相克倍率

每次属性攻击结算时，系统会根据**攻击方技能属性**与**防御方精灵属性**查表得出一个倍率：

| 倍率 | 含义 |
|------|------|
| **2.0** | 效果绝佳（攻击方克制防御方） |
| **0.5** | 效果不佳（攻击方被防御方抵抗） |
| **1.0** | 正常伤害（无克制关系，或未在矩阵中列出） |

> 在[相克矩阵页](/types/matrix)中，只展示非 1.0 的条目——也就是说，没有高亮即代表 1 倍正常伤害。

## 二、经典克制链

最基础的是草—水—火三角：

- **草** 克制 **水**（草系技能打水系精灵，2 倍伤害）
- **水** 克制 **火**
- **火** 克制 **草**

除此之外，18 种属性两两之间存在丰富的克制网络，例如电克水、冰克草、毒克草等。完整的两两关系请查阅[相克矩阵](/types/matrix)。

## 三、双属性叠加（关键）

很多精灵拥有**两个属性**（主属性 + 副属性）。双属性精灵的受击倍率，是两个属性各自倍率的**乘积**。

**举例**：假设一只精灵是「水 + 草」双属性，被**草系**技能攻击时：

- 对「水」属性：草克水 → 2.0
- 对「草」属性：草打草 → 1.0（无克制）
- 最终倍率 = 2.0 × 1.0 = **2.0**

再比如被**火系**技能攻击：

- 对「水」属性：水克火 → 防御方抵抗 → 0.5
- 对「草」属性：火克草 → 2.0
- 最终倍率 = 0.5 × 2.0 = **1.0**（火打水草双属性，反而抵消了）

这就是双属性精灵的魅力——合理的属性组合可以让原本的弱点被弥补。本站的[阵容模拟器](/tools/team-builder)会自动帮你计算队伍整体的弱点与攻击覆盖。

## 四、攻击与防御是两个视角

相克矩阵是对称反演的：

- 「A 克制 B」等价于「B 被 A 克制」
- 从**攻击方**看，用克制的属性打，伤害 ×2
- 从**防御方**看，被克制的属性打，受到 ×2

组建阵容时，要同时考虑：
1. **攻击覆盖**：队伍的技能属性能否覆盖常见对手的弱点
2. **防御弱点**：队伍精灵是否共享同一弱点（比如全是草系，会被一个火系技能团灭）

## 五、实战建议

- 对战前先看对方精灵属性，换上克制的精灵或技能。
- 双属性精灵通常比单属性更灵活，但要注意是否有「双倍弱点」（两个属性都被同一属性克制，倍率 4.0）。
- 善用本站[相克矩阵](/types/matrix)和[阵容模拟器](/tools/team-builder)做战前分析。

---

掌握相克，你就掌握了战斗的主动权。接下来可以了解[性格系统](/articles/mechanism-nature)如何进一步强化你的精灵。
"""

MECHANISM_NATURE_MD = """# 性格系统详解

每只精灵都有一个**性格**，它决定了六维能力值（生命、物攻、物防、魔攻、魔防、速度）中**一项增加、一项减少**。选对性格，能让精灵的优势最大化。

## 一、六维与性格的影响

精灵的六维能力值：

| 缩写 | 全称 | 说明 |
|------|------|------|
| 生命（HP） | 生命值 | 决定能承受多少伤害 |
| 物攻 | 物理攻击 | 物攻技能的伤害基础 |
| 物防 | 物理防御 | 减少受到的物攻伤害 |
| 魔攻 | 魔法攻击 | 魔攻技能的伤害基础 |
| 魔防 | 魔法防御 | 减少受到的魔攻伤害 |
| 速度 | 速度 | 决定出手先后顺序 |

性格的规则是：**某个属性增加（▲），另一个属性减少（▼）**。比如「大胆」是物攻▲、物防▼——牺牲物理防御换取更高的物理攻击。

## 二、全部 30 种性格一览

按「增加的属性」分组：

### 增加物攻

| 性格 | 增加 | 减少 |
|------|------|------|
| 大胆 | 物攻▲ | 物防▼ |
| 固执 | 物攻▲ | 魔攻▼ |
| 调皮 | 物攻▲ | 魔防▼ |
| 勇敢 | 物攻▲ | 速度▼ |
| 逞强 | 物攻▲ | 生命▼ |

### 增加物防

| 性格 | 增加 | 减少 |
|------|------|------|
| 稳重 | 物防▲ | 物攻▼ |
| 天真 | 物防▲ | 魔攻▼ |
| 懒散 | 物防▲ | 魔防▼ |
| 悠闲 | 物防▲ | 速度▼ |
| 坦率 | 物防▲ | 生命▼ |

### 增加魔攻

| 性格 | 增加 | 减少 |
|------|------|------|
| 聪明 | 魔攻▲ | 物攻▼ |
| 专注 | 魔攻▲ | 物防▼ |
| 偏执 | 魔攻▲ | 魔防▼ |
| 冷静 | 魔攻▲ | 速度▼ |
| 理性 | 魔攻▲ | 生命▼ |

### 增加魔防

| 性格 | 增加 | 减少 |
|------|------|------|
| 警惕 | 魔防▲ | 物攻▼ |
| 温顺 | 魔防▲ | 物防▼ |
| 害羞 | 魔防▲ | 魔攻▼ |
| 慎重 | 魔防▲ | 速度▼ |
| 焦虑 | 魔防▲ | 生命▼ |

### 增加速度

| 性格 | 增加 | 减少 |
|------|------|------|
| 胆小 | 速度▲ | 物攻▼ |
| 急躁 | 速度▲ | 物防▼ |
| 开朗 | 速度▲ | 魔攻▼ |
| 莽撞 | 速度▲ | 魔防▼ |
| 热情 | 速度▲ | 生命▼ |

### 增加生命

| 性格 | 增加 | 减少 |
|------|------|------|
| 沉默 | 生命▲ | 物攻▼ |
| 忧郁 | 生命▲ | 物防▼ |
| 平和 | 生命▲ | 魔攻▼ |
| 粗心 | 生命▲ | 魔防▼ |
| 踏实 | 生命▲ | 速度▼ |

## 三、按定位选择性格

### 物理输出手（用物攻技能）

推荐减少**魔攻**的性格（因为物理输出手用不到魔攻）：

- **固执**（物攻▲/魔攻▼）：纯物理输出首选
- **勇敢**（物攻▲/速度▼）：不在乎先手时可选

### 魔法输出手（用魔攻技能）

推荐减少**物攻**的性格：

- **聪明**（魔攻▲/物攻▼）：纯魔法输出首选
- **冷静**（魔攻▲/速度▼）：慢速爆发型

### 速度型（抢先手）

- **胆小**（速度▲/物攻▼）：魔法速攻手
- **开朗**（速度▲/魔攻▼）：物理速攻手

### 肉盾 / 坦克

- **大胆**（物攻▲/物防▼）：兼顾输出（如果用物攻技能）
- **坦率**（物防▲/生命▼）：纯物防坦克
- **焦虑**（魔防▲/生命▼）：特防坦克

> 注意：减少**生命**的性格通常不推荐给坦克——血量对所有精灵都很重要。

## 四、子性格

每个主性格还对应若干**子性格**（如「喜欢独处」「警惕性强」等）。子性格会带来一些细微的额外倾向，但主性格的增减效果是决定性的。追求极限面板时主要关注主性格即可。

## 五、怎么看精灵该选什么性格

1. 打开精灵[详情页](/pets)，看它的**种族值**分布——哪一维最高，就往那个方向强化。
2. 看它的**技能池**——主要用物攻还是魔攻技能。
3. 速度是否关键——PVP 中先手优势巨大。

想深入了解种族值如何影响面板？请阅读[精灵培养指南](/articles/mechanism-training)。
"""

MECHANISM_TRAINING_MD = """# 精灵培养指南：种族值、个体值与面板计算

面对几百只精灵，怎么判断哪只值得练？本篇解析决定精灵强度的几个核心维度，帮你把资源花在刀刃上。

## 一、种族值（Base Stats）：精灵的先天潜力

种族值是每只精灵与生俱来的六维基础数值（生命/物攻/物防/魔攻/魔防/速度），**决定了这只精灵的成长上限**。

- 种族值高的维度，升级后面板也越高。
- 比如 [喵喵](/pets/pet-0001) 的魔防种族值突出（91），它天生就适合做特防坦克。

> 在本站[精灵图鉴](/pets)的详情页，每只精灵都展示了六维种族值雷达图，直观对比强弱项。

## 二、个体值：同种精灵的差异

即使是同一种精灵，每只个体的能力也有细微差异，这就是**个体值**。它会在种族值的基础上，给每一维加一个小的浮动量。

- 个体值高的精灵，同等级下面板略高。
- 捕捉或孵蛋时，个体值是随机的——这就是为什么资深玩家会反复抓同一种精灵，挑选「了不起天分」的高个体值个体。

> 图鉴课题里常有「捕捉 1 只了不起天分的精灵」，指的就是高个体值个体。

## 三、性格的加成

如[性格系统详解](/articles/mechanism-nature)所述，性格会让某一维 ×1.1、另一维 ×0.9（增减约 10%）。选对性格相当于免费提升 10% 的核心属性。

## 四、阶段（进化）的影响

精灵进化到更高阶时，**种族值会整体提升**：

- 一阶 → 二阶：六维全面提升
- 二阶 → 三阶（如果有）：再次提升

所以**最终形态的精灵面板远高于初始形态**。培养时要注意：
- 尽量培养到**最终进化形态**再投入大量资源。
- 进化需要达到指定等级（少数有特殊条件），查看[详情页](/pets)的进化链了解要求。

## 五、面板的构成（简化）

一只精灵某一级别的最终面板，大致是这些因素叠加的结果：

```
最终面板 ≈ (种族值 + 个体值) × 等级系数 × 性格修正 × 阶段系数
```

- **种族值 + 个体值**：先天基础
- **等级系数**：等级越高面板越高
- **性格修正**：核心维 ×1.1，弱项 ×0.9
- **阶段系数**：进化越高系数越大

## 六、判断「值不值得练」的清单

培养一只精灵前，对照以下标准：

1. **种族值分布合理吗？**
   - 输出手：物攻或魔攻种族值 ≥ 80（三阶最终形态参考）
   - 速度手：速度种族值 ≥ 70
   - 坦克：防御种族值 + 生命种族值总和够高

2. **技能池配合种族值吗？**
   - 物攻高的精灵，技能池里要有强力的物攻技能（查看[技能库](/skills)按属性筛选）。
   - 魔攻高的精灵，主要用魔攻技能。

3. **属性组合有弱点吗？**
   - 查[相克矩阵](/types/matrix)，避免双倍弱点（4 倍受击）。

4. **个体值如何？**
   - 挑「了不起天分」的个体。

5. **性格选对了吗？**
   - 参考[性格选择策略](/articles/mechanism-nature)。

## 七、资源分配建议

前期资源有限，建议：

- **集中培养 3-5 只核心精灵**，而不是平均分配。
- 优先培养**御三家**（喵喵/水蓝蓝/火花），它们进化链完整、属性实用。
- 用本站[阵容模拟器](/tools/team-builder)检查队伍的属性覆盖和弱点。
- 中后期再捕捉、筛选高个体值的稀有精灵。

---

理解了培养机制，接下来学习[捕捉技巧](/articles/mechanism-capture)，让你更高效地获得优秀个体。
"""

MECHANISM_CAPTURE_MD = """# 捕捉机制详解

捕捉精灵是洛克王国的核心玩法之一。了解捕捉机制，能让你用更少的精灵球、更高的成功率把心仪的精灵收入囊中。

## 一、捕捉的基本流程

进入战斗后，把野生精灵的血量压低，然后投掷精灵球，系统会根据一系列因素计算**捕捉成功率**，判定是否捕捉成功。

> 捕捉不是「球扔了就一定成功」——成功率是一个概率值，受多个因素影响。

## 二、影响捕捉概率的因素

### 1. 目标血量（最重要）

**血量越低，捕捉成功率越高。**

- 满血精灵极难捕捉。
- 把血量压到**红色血条（残血）**时，成功率大幅提升。
- 但注意：别把精灵打死了——血量归零则战斗结束，无法捕捉。

> 理想状态是把血量压到「接近击败但没击败」的残血线。

### 2. 异常状态

给目标施加**异常状态**（中毒、麻痹、睡眠、灼烧等）会提升捕捉成功率：

- **睡眠**：通常加成最高（沉睡的精灵更容易捕捉）。
- **麻痹 / 中毒 / 灼烧**：也有一定加成。
- 没有异常状态的精灵，捕捉成功率较低。

实战技巧：先用技能施加睡眠或麻痹，再压血，最后扔球。

### 3. 精灵球的种类

不同精灵球有不同的**捕获率加成**。本站[道具图鉴](/items)的「咕噜球」分类下可以查看各种精灵球。

常见的精灵球类型：

| 精灵球 | 特点 |
|--------|------|
| 普通球 | 基础捕获率，无特殊加成 |
| 高级球 | 整体捕获率更高 |
| 狎狌球 | 对特定情况有额外加成 |

> 具体每种球的加成数值，可在[道具图鉴](/items)筛选「咕噜球」查看。

### 4. 目标精灵的稀有度

稀有度高的精灵（如传说精灵）天生**更难捕捉**，基础捕获率更低。对付它们需要：
- 更精细的压血控制
- 高级精灵球
- 异常状态配合

## 三、实战捕捉流程

推荐的标准化捕捉流程：

1. **侦查**：用不克制目标的弱技能试探，避免一击致命。
2. **压血**：用低威力技能或反复小幅攻击，把血量压到红色残血线。
3. **施加异常**：用睡眠 / 麻痹技能让目标进入异常状态。
4. **投球**：选择合适的精灵球投掷。失败就重复投掷。
5. **耐心**：稀有精灵可能需要多次尝试。

## 四、常见误区

- **误区 1：满血直接扔球**。成功率极低，浪费球。一定要先压血。
- **误区 2：用最强技能打**。容易一击击杀，错失捕捉机会。准备 1-2 个低威力技能用于压血。
- **误区 3：忽视异常状态**。睡眠 / 麻痹的加成非常可观，能显著提升成功率。

## 五、资源管理

- 前期普通球够用，遇到稀有精灵再上高级球。
- 精灵球可以通过[道具图鉴](/items)查「来源」字段了解获取途径（商店购买、任务奖励等）。
- 捕捉稀有精灵前，多准备几个球以防失败。

## 六、关于个体值筛选

捕捉到精灵后，记得检查它的**个体值**——同种精灵个体值有差异。追求极限面板的玩家会反复捕捉同一种精灵，挑选高个体值个体。

> 图鉴课题「捕捉 1 只了不起天分的精灵」指的就是高个体值个体，留意系统提示。

---

掌握捕捉机制，配合[性格选择](/articles/mechanism-nature)和[培养指南](/articles/mechanism-training)，你就能组建一支强大的精灵队伍。祝捕捉顺利！
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
