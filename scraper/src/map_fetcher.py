"""地图点位抓取器：从 BWIKI Data:Mapnew 数据页面提取地图标记点 + 地名。

数据源（调研确认，与 BWIKI「大地图」页面同源）：
- 类型元数据：``Data:Mapnew/type/json``（296 种，含 markType / markTypeName / icon）
- 坐标数据：``Data:Mapnew/type/{markType}/json``（151 个类型页，每个含若干 lat/lng 点位）
- 文字图层：``Data:Mapnew/type/textLayer/json``（地名标注：洛克里安 / 魔法师之家 等）

BWIKI 大地图渲染方案（我们复用）：
- Leaflet + Simple CRS（平面坐标）
- 底图瓦片：``https://wiki-dev-patch-oss.aliyuncs.com/res/lkwg/map-3.0/{z}/tile-{x}_{y}.png``
- center [0,0], zoom 5, minZoom 4, maxZoom 8

icon 字段形如 ``{{filepath:地图_点位_icon_庇护所.png}}``，前端拼 ``Special:FilePath/xxx``。

产物：``data/seed/map_points.json``，结构::

    {"meta": {...}, "items": [{"mark_type","type_name","icon","title","desc","lat","lng","layer"}],
     "text_layers": [{"text","lat","lng","layer","min_zoom","max_zoom"}]}
"""

from __future__ import annotations

import json
import re

from .api import WikiApi


def _extract_icon_name(icon_field: str) -> str | None:
    """``{{filepath:地图_点位_icon_庇护所.png}}`` → ``地图_点位_icon_庇护所.png``。"""
    if not icon_field:
        return None
    m = re.search(r"filepath:([^}|]+)", icon_field)
    return m.group(1).strip() if m else None


def fetch_map_points(api: WikiApi) -> tuple[list[dict], list[dict], dict]:
    """抓取 Mapnew 全部点位 + 文字图层。返回 (items, text_layers, stats)。

    items：点位列表（含 icon/title/坐标/layer）
    text_layers：地名文字标注列表
    """
    # 1. 类型元数据（markType → {name, icon}）
    type_meta: dict[str, dict] = {}
    try:
        meta_text = api.fetch_module_wikitext("Data:Mapnew/type/json")
        meta_data = json.loads(meta_text)
        raw_types = meta_data.get("data", meta_data) if isinstance(meta_data, dict) else meta_data
        if isinstance(raw_types, list):
            for t in raw_types:
                if not isinstance(t, dict):
                    continue
                mid = str(t.get("markType", ""))
                if mid:
                    type_meta[mid] = {
                        "name": t.get("markTypeName", f"类型{mid}"),
                        "icon": _extract_icon_name(t.get("icon", "")),
                    }
    except Exception as ex:  # noqa: BLE001
        print(f"[map] 类型元数据解析失败（继续，用点位页内 type_name 兜底）: {ex}")
    print(f"[map] 类型元数据: {len(type_meta)} 种")

    # 2. 列出实际存在的类型页
    type_ids = _list_type_pages(api)
    print(f"[map] 实际存在的类型页: {len(type_ids)} 个")

    # 3. 逐类型抓取坐标
    items: list[dict] = []
    fetch_ok = fetch_fail = 0
    for mark_type in type_ids:
        meta = type_meta.get(mark_type, {})
        type_name = meta.get("name", f"类型{mark_type}")
        icon = meta.get("icon")
        try:
            text = api.fetch_module_wikitext(f"Data:Mapnew/type/{mark_type}/json")
            pts = _parse_points(text, mark_type, type_name, icon)
            items.extend(pts)
            fetch_ok += 1
        except Exception as ex:  # noqa: BLE001
            fetch_fail += 1
            if fetch_fail <= 3:
                print(f"[map]   {mark_type} {type_name} 抓取失败: {ex}")

    # 4. 文字图层（地名标注）
    text_layers = _fetch_text_layers(api)

    stats = {
        "types_in_meta": len(type_meta),
        "type_pages": len(type_ids),
        "fetch_ok": fetch_ok,
        "fetch_fail": fetch_fail,
        "total_points": len(items),
        "text_layers": len(text_layers),
    }
    return items, text_layers, stats


def _list_type_pages(api: WikiApi) -> list[str]:
    """列出 Data:Mapnew/type/ 下实际存在的 {id}/json 页面（不含 textLayer/json）。"""
    browser_ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
    api._throttle()
    resp = api._session.post(
        f"{api.base_url}/api.php",
        data={
            "action": "query", "list": "allpages", "apprefix": "Data:Mapnew/type/",
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
        # Data:Mapnew/type/201/json → "201"，排除 type/json 和 textLayer/json
        m = re.match(r"Data:Mapnew/type/(\d+)/json$", title)
        if m:
            ids.append(m.group(1))
    return ids


def _parse_points(text: str, mark_type: str, type_name: str, icon: str | None) -> list[dict]:
    """解析单个类型页的 JSON 坐标数据为 items 列表。"""
    text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict) and "data" in data:
        data = data["data"]
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
            "icon": icon,
            "title": pt.get("title") or "",
            "desc": pt.get("desc") or "",
            "lat": _to_float(lat),
            "lng": _to_float(lng),
            "layer": pt.get("layer") or "G",
        })
    return items


def _fetch_text_layers(api: WikiApi) -> list[dict]:
    """抓取文字图层（地名标注）。"""
    try:
        text = api.fetch_module_wikitext("Data:Mapnew/type/textLayer/json")
        data = json.loads(text)
        # textLayer 是 {"G": [...], "B1": [...]} 按图层分组
        result: list[dict] = []
        layers = data if isinstance(data, list) else []
        if isinstance(data, dict):
            # 合并所有图层
            for layer_name, pts in data.items():
                if isinstance(pts, list):
                    for pt in pts:
                        result.append(_parse_text_layer(pt, layer_name))
        else:
            for pt in layers:
                result.append(_parse_text_layer(pt, pt.get("layer", "G")))
        return [r for r in result if r]
    except Exception as ex:  # noqa: BLE001
        print(f"[map] 文字图层抓取失败（跳过）: {ex}")
        return []


def _parse_text_layer(pt: dict, layer: str) -> dict | None:
    """解析单条文字图层。"""
    if not isinstance(pt, dict):
        return None
    point = pt.get("point") or {}
    lat = point.get("lat")
    lng = point.get("lng")
    text = pt.get("text")
    if lat is None or lng is None or not text:
        return None
    return {
        "text": text,
        "lat": _to_float(lat),
        "lng": _to_float(lng),
        "layer": pt.get("layer", layer),
        "min_zoom": _to_int(pt.get("minZoom")),
        "max_zoom": _to_int(pt.get("maxZoom")),
    }


def _to_float(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _to_int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None
