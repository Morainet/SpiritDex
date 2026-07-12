"""解析 BWIKI ``Widget:RestrainCalc.js`` 中的属性相克矩阵。

Widget 源码里有一个 JS 对象 ``typeEffectChart = { 属性名: {strong:[...],resist:[...],...} }``。
本模块只提取这部分，转成 ``[(attacking, defending, multiplier), ...]``。

约定（来自研究）：
- ``strong``：攻击方对所列防御方 **2x 克制**
- ``resist``：攻击方对所列防御方 **0.5x 减半**
- ``weak`` / ``vulnerable`` 是防御视角的冗余表达，本模块**只用 strong/resist**
  作为攻击方 → 防御方的权威源。
"""

from __future__ import annotations

import re


def extract_type_effectiveness(widget_source: str) -> list[tuple[str, str, float]]:
    """从 Widget 源码提取相克关系。

    返回 ``[(attacking_type中文, defending_type中文, multiplier), ...]``，
    仅含非 1.0 的条目。
    """
    chart = _extract_chart_object(widget_source)
    if not chart:
        raise ValueError("未在 Widget 源码中找到 typeEffectChart 对象")

    pairs: list[tuple[str, str, float]] = []
    seen: set[tuple[str, str]] = set()
    for atk, fields in chart.items():
        for def_name in fields.get("strong", []):
            if not def_name or (atk, def_name) in seen:
                continue
            pairs.append((atk, def_name, 2.0))
            seen.add((atk, def_name))
        for def_name in fields.get("resist", []):
            if not def_name or (atk, def_name) in seen:
                continue
            pairs.append((atk, def_name, 0.5))
            seen.add((atk, def_name))
    return pairs


def _extract_chart_object(source: str) -> dict[str, dict[str, list[str]]]:
    """定位 ``typeEffectChart = {...}`` 并解析每个属性的 strong/resist/weak/vulnerable 数组。

    用正则按属性名切块（避免写完整 JS 解析器）；数据结构规整、无深层嵌套。
    """
    # 定位 typeEffectChart = { 起始
    m = re.search(r"typeEffectChart\s*=\s*\{", source)
    if not m:
        return {}
    start = m.end() - 1  # 指向 '{'
    body = _balanced_brace(source, start)
    if not body:
        return {}

    chart: dict[str, dict[str, list[str]]] = {}
    # 按顶层 key 切块：形如  '普通': { ... },  "草": { ... },  或  普通: { ... }
    # key 可以是单引号/双引号字符串或裸词（中文属性名）。
    # 用正则匹配 key: { 起始，再取花括号内容。
    for km in re.finditer(r"""(?:"([^"]+)"|'([^']+)'|([^\s:{,]+))\s*:\s*\{""", body):
        type_name = km.group(1) or km.group(2) or km.group(3)
        brace_start = km.end() - 1
        inner = _balanced_brace(body, brace_start)
        if inner is None:
            continue
        fields = _parse_fields(inner)
        if fields:
            chart[type_name] = fields
    return chart


def _balanced_brace(s: str, start: int) -> str | None:
    """返回从 ``s[start]``（应为 ``{``）开始到匹配 ``}`` 的子串（含首尾花括号）。"""
    if start >= len(s) or s[start] != "{":
        return None
    depth = 0
    i = start
    while i < len(s):
        c = s[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
        i += 1
    return None


def _parse_fields(obj_body: str) -> dict[str, list[str]]:
    """从 ``{strong:[...], resist:[...], ...}`` 提取四个数组（中文字符串元素）。

    元素可能是单引号或双引号字符串，如 ``['地', '幽']`` 或 ``["水"]``。
    """
    out: dict[str, list[str]] = {}
    for field in ("strong", "resist", "weak", "vulnerable"):
        m = re.search(rf"{field}\s*:\s*\[([^\]]*)\]", obj_body)
        if not m:
            out[field] = []
            continue
        # 匹配单引号或双引号包裹的元素
        items = re.findall(r"""(?:"([^"]*)"|'([^']*)')""", m.group(1))
        out[field] = [a or b for a, b in items]
    return out
