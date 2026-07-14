"""道具抓取器：从 BWIKI「道具」分类的页面级 wikitext 提取结构化道具信息。

数据源（调研确认）：
- 抓 ``Category:道具`` 全部成员（约 1780 页），逐页拉 wikitext
- 每页含 ``{{物品信息|物品名称=...|稀有度=...|主分类=...|...}}`` 模板，字段高度一致

模板字段映射（9 字段）::

    物品名称 → name          稀有度 → rarity        主分类 → main_category
    次分类 → sub_category    用途   → usage         描述   → description
    来源   → source          icon   → icon_id       道具版本 → data_version

主分类枚举：材料/技能石/重要/精灵蛋/精灵果实/任务/家具/咕噜球（8 类）
稀有度枚举：紫/蓝/橙/绿（4 级）

产物：``data/seed/items.json``，结构与其他 seed 文件一致::

    {"meta": {...}, "items": [{"slug", "catalog_id", "name", "rarity", ...}]}

合规：复用 ``WikiApi``（QPS≤1、UA、POST 绕 WAF）；1780 页 × 1s ≈ 30 分钟。
噪声过滤：``cmtype=page`` 仅取内容页（排除「模板:物品信息」等 NS10 页面）。
"""

from __future__ import annotations

import re

from .api import WikiApi

# 模板参数行正则（与 skill_pool_fetcher._extract_template_params 同款）
_PARAM_RE = re.compile(r"^\s*\|([^=]+?)=(.*)$")

# BWIKI 物品模板的参数名 → seed 字段名
_FIELD_MAP = {
    "物品名称": "name",
    "稀有度": "rarity",
    "主分类": "main_category",
    "次分类": "sub_category",
    "用途": "usage",
    "描述": "description",
    "来源": "source",
    "icon": "icon_id",
    "道具版本": "data_version",
}


def extract_item_params(wikitext: str) -> dict[str, str] | None:
    """提取 ``{{物品信息|...}}`` 模板的命名参数。

    与 skill_pool_fetcher._extract_template_params 同构：定位模板起点，
    扫描到 ``}}``，逐行收集 ``|key=value``。模板不嵌套，参数均为纯文本。
    返回参数 dict；无 ``{{物品信息}}`` 模板返回 None。
    """
    start = wikitext.find("{{物品信息")
    if start == -1:
        return None
    params: dict[str, str] = {}
    body = wikitext[start:]
    end = body.find("}}")
    if end != -1:
        body = body[:end]
    for line in body.splitlines():
        m = _PARAM_RE.match(line)
        if m:
            params[m.group(1).strip()] = m.group(2).strip()
    return params if params else None


def parse_item(page_title: str, wikitext: str, seq: int) -> dict | None:
    """把单页 wikitext 解析为 seed item dict。

    page_title 用作 catalog_id（BWIKI 页面名，稳定唯一）和 source_url。
    seq 是抓取顺序序号，用于生成稳定 slug（item-0001）。
    无模板返回 None（让调用方跳过）。
    """
    params = extract_item_params(wikitext)
    if params is None:
        return None
    item: dict = {
        "slug": f"item-{seq:04d}",
        "catalog_id": page_title,
        "name": params.get("物品名称") or page_title,  # 兜底用页面名
    }
    # 按字段映射取值（缺失字段不写，由后端填 null）
    for cn_field, en_field in _FIELD_MAP.items():
        if cn_field == "物品名称":
            continue  # name 已处理
        val = params.get(cn_field)
        if val:  # 空字符串不写入（保持 None 语义）
            item[en_field] = val
    return item


def fetch_items(
    api: WikiApi,
    *,
    limit: int | None = None,
    progress_every: int = 100,
) -> tuple[list[dict], dict]:
    """抓取 Category:道具 全部道具。

    返回 ``(items, stats)``：
    - items：seed item 列表（已去重、按抓取顺序编号）
    - stats：统计字典（总页数、成功/失败/无模板计数）

    limit：调试用，限制抓取页数（前 N 个分类成员）。
    """
    titles = _list_category_members(api, "Category:道具")
    if limit:
        titles = titles[:limit]
    total = len(titles)
    print(f"[item] Category:道具 共 {total} 个页面，开始逐页抓取（QPS≤1）...")

    items: list[dict] = []
    seen_slugs: set[str] = set()
    fetch_ok = parse_ok = fetch_fail = no_template = 0

    for i, title in enumerate(titles, start=1):
        try:
            wikitext = api.fetch_module_wikitext(title)
            fetch_ok += 1
            item = parse_item(title, wikitext, seq=len(items) + 1)
            if item is None:
                no_template += 1
                continue
            # 防御性去重：同名页面（罕见）跳过
            slug = item["slug"]
            if slug in seen_slugs:
                continue
            seen_slugs.add(slug)
            items.append(item)
            parse_ok += 1
        except Exception as ex:  # noqa: BLE001 —— 单页失败不阻断整体
            fetch_fail += 1
            if i <= 5 or i % 200 == 0:
                print(f"[item]   {title!r} 抓取失败: {ex}")

        if i % progress_every == 0 or i == total:
            print(f"[item]   进度 {i}/{total}（抓取成功 {fetch_ok}，解析成功 {parse_ok}，"
                  f"无模板 {no_template}，失败 {fetch_fail}）")

    stats = {
        "total_pages": total,
        "fetch_ok": fetch_ok,
        "fetch_fail": fetch_fail,
        "no_template": no_template,
        "items": len(items),
    }
    return items, stats


def _list_category_members(api: WikiApi, category: str) -> list[str]:
    """分页列出分类下的内容页面标题（cmtype=page 过滤掉模板/子分类）。

    用 MediaWiki ``action=query&list=categorymembers``，cmlimit=500 分页，
    遵循 continue 游标。
    """
    browser_ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
    titles: list[str] = []
    cont: dict | None = None
    while True:
        api._throttle()
        data = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": category,
            "cmlimit": "500",
            "cmtype": "page",  # 仅内容页，排除 NS10 模板/NS14 子分类
            "format": "json",
            "formatversion": "2",
        }
        if cont:
            data.update(cont)
        resp = api._session.post(
            f"{api.base_url}/api.php",
            data=data,
            headers={"User-Agent": browser_ua, "Referer": f"{api.base_url}/"},
            timeout=api.timeout,
        )
        resp.raise_for_status()
        j = resp.json()
        members = j.get("query", {}).get("categorymembers", [])
        titles += [m["title"] for m in members if m.get("title")]
        cont = j.get("continue")
        if not cont:
            break
    return titles
