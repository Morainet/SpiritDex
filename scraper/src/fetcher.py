"""拉取并解析 5 个 Lua 数据模块，返回统一的原始数据结构。

职责：
- 调用 ``WikiApi`` 取 wikitext
- 用 ``lua_parser`` 解析为 Python dict
- 汇总为 ``RawData``，供 ``transformers`` 加工成 seed JSON
- 支持「离线模式」：若已存在本地缓存（tests/fixtures），优先用缓存，便于无网/CI 运行
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from . import lua_parser
from .api import PET_DATA_MODULES, WikiApi
from .config import settings


@dataclass
class RawData:
    """五个模块解析后的统一容器。"""
    core: dict = field(default_factory=dict)            # pet_XXXXXX -> {...}
    index: dict = field(default_factory=dict)           # by_id / by_name ...
    skills: dict = field(default_factory=dict)          # skill_XXXXXX -> {...}
    evolutions: dict = field(default_factory=dict)      # evo_XXXXXX -> {chain:[...], name}
    handbook: dict = field(default_factory=dict)        # handbook_XXXXXX -> {...}
    type_chart_pairs: list = field(default_factory=list)  # [(atk中文, def中文, multiplier)]
    source_url: str = ""


_MODULE_TO_FIELD = {
    "Module:PetData/Core": "core",
    "Module:PetData/Index": "index",
    "Module:PetData/SkillCatalog": "skills",
    "Module:PetData/Evolution": "evolutions",
    "Module:PetData/Handbook": "handbook",
}


def fetch(api: WikiApi | None = None, *, use_fixture_cache: bool = False) -> RawData:
    """拉取并解析全部模块。

    ``use_fixture_cache=True`` 时，若 ``tests/fixtures/`` 存在对应 txt 则读缓存（不联网），
    便于离线开发/CI。否则走 ``WikiApi`` 实时拉取。
    """
    api = api or WikiApi()
    raw = RawData(source_url=api.page_url("Module:PetData/Core"))
    for module in PET_DATA_MODULES:
        text = _load_text(module, api, use_fixture_cache)
        parsed = lua_parser.parse_table_module(text)
        setattr(raw, _MODULE_TO_FIELD[module], parsed)
    # 相克矩阵：从 BWIKI Widget:RestrainCalc.js 抓取（离线模式无缓存则留空）
    raw.type_chart_pairs = _load_type_chart(api, use_fixture_cache)
    return raw


def _load_type_chart(api: WikiApi, use_fixture_cache: bool) -> list:
    """拉取属性相克矩阵 widget 并解析；失败不阻断主流程（返回空）。"""
    try:
        cached = _fixture_path("Widget:RestrainCalc.js")
        if use_fixture_cache and os.path.isfile(cached):
            with open(cached, encoding="utf-8") as f:
                source = f.read()
        else:
            source = api.fetch_widget_source("RestrainCalc.js")
        from . import widget_parser
        return widget_parser.extract_type_effectiveness(source)
    except Exception as ex:  # noqa: BLE001 - 相克非阻断，缺数据时仅警告
        import logging
        logging.getLogger("scraper").warning("相克矩阵抓取失败（跳过）: %s", ex)
        return []


def _load_text(module: str, api: WikiApi, use_fixture_cache: bool) -> str:
    if use_fixture_cache:
        cached = _fixture_path(module)
        if os.path.isfile(cached):
            with open(cached, encoding="utf-8") as f:
                return f.read()
    return api.fetch_module_wikitext(module)


def _fixture_path(module: str) -> str:
    # Module:PetData/Core -> tests/fixtures/Module_PetData_Core.txt
    name = module.replace(":", "_").replace("/", "_") + ".txt"
    return os.path.join(
        os.path.dirname(__file__), "..", "tests", "fixtures", name
    )
