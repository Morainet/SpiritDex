"""地图点位抓取器：从 BWIKI Data:MapV2 数据页面提取地图标记点。

数据源（调研确认）：
- 点位类型元数据：``Data:MapV2/type/json``（markType / markTypeName 中文名）
- 各类型坐标数据：``Data:MapV2/type/{markType}/json``（lat/lng 游戏内坐标 + title/desc）

11 种点位类型：庇护所(201)/传送点(202)/炼金台(203)/副本(204)/
普通宝箱(301)/稀有宝箱(302)/珍贵宝箱(303)/传说宝箱(304)/
拾遗任务(401)/奇谭任务(402)/旅途任务(403)

⚠️ 坐标为游戏内平面坐标系（范围约 -3000~3000），非真实经纬度。
无官方地图底图，前端用坐标网格背景替代。

产物：``data/seed/map_points.json``，结构::

    {"meta": {...}, "items": [{"mark_type", "type_name", "title", "desc", "lat", "lng"}]}
"""

from __future__ import annotations

import json
import re

from .api import WikiApi

# V1 点位类型（Data:Map/type/json 的 markTypeName）
# V2 的类型页是 Data:MapV2/type/{id}/json，类型名从 type/json 取
# 这里用调研确认的 11 种类型（markType -> 中文名），作为兜底（type/json 解析失败时用）
_FALLBACK_TYPES = {
    "201": "庇护所", "202": "传送点", "203": "炼金台", "204": "副本",
    "301": "普通宝箱", "302": "稀有宝箱", "303": "珍贵宝箱", "304": "传说宝箱",
    "401": "拾遗任务", "402": "奇谭任务", "403": "旅途任务",
}


def fetch_map_points(api: WikiApi) -> tuple[list[dict], dict]:
    """抓取全部地图点位。返回 (items, stats)。

    策略：
    1. 先尝试解析 ``Data:MapV2/type/json`` 拿类型名映射（可能含 #invoke 动态渲染失败）
    2. 用 allpages 列出 ``Data:MapV2/type/*/json`` 实际存在的类型页
    3. 逐类型抓取坐标数据，合并 title/desc
    """
    # 1. 类型名映射（markType -> 中文）
    type_names = dict(_FALLBACK_TYPES)
    try:
        meta_text = api.fetch_module_wikitext("Data:MapV2/type/json")
        # 尝试提取 markType / markTypeName 对（可能是带 #invoke 的 wikitext，解析不到就用兜底）
        for m in re.finditer(r'"markType":(\d+).*?"markTypeName":"([^"]+)"', meta_text):
            type_names[m.group(1)] = m.group(2)
    except Exception:  # noqa: BLE001 —— 元数据解析失败用兜底
        pass
    print(f"[map] 点位类型: {len(type_names)} 种")

    # 2. 列出实际存在的 V2 类型页
    type_ids = _list_type_pages(api)
    print(f"[map] 实际存在的类型页: {len(type_ids)} 个 ({type_ids})")

    # 3. 逐类型抓取坐标
    items: list[dict] = []
    fetch_ok = fetch_fail = 0
    for mark_type in type_ids:
        type_name = type_names.get(mark_type, f"类型{mark_type}")
        try:
            text = api.fetch_module_wikitext(f"Data:MapV2/type/{mark_type}/json")
            points = _parse_points(text, mark_type, type_name)
            items.extend(points)
            fetch_ok += 1
            print(f"[map]   {mark_type} {type_name}: {len(points)} 个点位")
        except Exception as ex:  # noqa: BLE001
            fetch_fail += 1
            print(f"[map]   {mark_type} {type_name} 抓取失败: {ex}")

    stats = {
        "type_count": len(type_ids),
        "fetch_ok": fetch_ok,
        "fetch_fail": fetch_fail,
        "total_points": len(items),
    }
    return items, stats


def _list_type_pages(api: WikiApi) -> list[str]:
    """列出 Data:MapV2/type/ 下实际存在的 {id}/json 页面，返回 markType id 列表。"""
    browser_ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
    api._throttle()
    resp = api._session.post(
        f"{api.base_url}/api.php",
        data={
            "action": "query", "list": "allpages", "apprefix": "Data:MapV2/type/",
            "apnamespace": "0", "aplimit": "500", "format": "json", "formatversion": "2",
        },
        headers={"User-Agent": browser_ua, "Referer": f"{api.base_url}/"},
        timeout=api.timeout,
    )
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("allpages", [])
    ids: list[str] = []
    for p in pages:
        title = p.get("title", "")
        # Data:MapV2/type/201/json -> "201"
        m = re.match(r"Data:MapV2/type/(\d+)/json$", title)
        if m:
            ids.append(m.group(1))
    return ids


def _parse_points(text: str, mark_type: str, type_name: str) -> list[dict]:
    """解析单个类型页的 JSON 坐标数据为 items 列表。"""
    text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    items: list[dict] = []
    for pt in data:
        if not isinstance(pt, dict):
            continue
        point = pt.get("point") or {}
        lat = point.get("lat")
        lng = point.get("lng")
        if lat is None or lng is None:
            continue
        items.append({
            "mark_type": int(mark_type),
            "type_name": type_name,
            "title": pt.get("title") or "",
            "desc": pt.get("desc") or "",
            "lat": _to_float(lat),
            "lng": _to_float(lng),
        })
    return items


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None
