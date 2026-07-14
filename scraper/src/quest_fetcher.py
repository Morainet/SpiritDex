"""任务图鉴抓取器：从 BWIKI「任务」分类的页面级 wikitext 提取任务信息。

数据源（调研确认）：
- 抓 ``Category:任务`` 全部成员（18 个内容页），逐页拉 wikitext
- 每页含 ``{{任务信息|任务序号=...|任务分类=...|任务名称=...|...}}`` 模板，9 字段 100% 一致

模板字段映射::

    任务序号 → seq          任务分类 → category    任务名称 → name
    任务地点 → location      任务描述 → description 任务奖励 → reward
    任务图片 → image_key     任务备注 → note        任务归属 → attribution

任务分类枚举：旅途 / 奇谭 / 拾遗（3 类）

产物：``data/seed/quests.json``，结构与其他 seed 文件一致。
"""

from __future__ import annotations

import re

from .api import WikiApi

_PARAM_RE = re.compile(r"^\s*\|([^=]+?)=(.*)$")

_FIELD_MAP = {
    "任务序号": "seq",
    "任务分类": "category",
    "任务名称": "name",
    "任务地点": "location",
    "任务描述": "description",
    "任务奖励": "reward",
    "任务图片": "image_key",
    "任务备注": "note",
    "任务归属": "attribution",
}


def extract_quest_params(wikitext: str) -> dict[str, str] | None:
    """提取 ``{{任务信息|...}}`` 模板参数。无模板返回 None。"""
    start = wikitext.find("{{任务信息")
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


def parse_quest(page_title: str, wikitext: str, num: int) -> dict | None:
    """把单页 wikitext 解析为 seed item dict。无模板返回 None。"""
    params = extract_quest_params(wikitext)
    if params is None:
        return None
    # catalog_id：去掉「任务:」前缀，用任务名称（与 BWIKI 页面对应）
    name = params.get("任务名称") or page_title.replace("任务:", "")
    item: dict = {
        "slug": f"quest-{num:04d}",
        "catalog_id": name,  # 任务名称稳定唯一
        "name": name,
    }
    for cn_field, en_field in _FIELD_MAP.items():
        if cn_field == "任务名称":
            continue
        val = params.get(cn_field)
        if val:
            item[en_field] = val
    return item


def fetch_quests(api: WikiApi, *, limit: int | None = None) -> tuple[list[dict], dict]:
    """抓取 Category:任务 全部任务。返回 (items, stats)。"""
    titles = _list_category_members(api, "Category:任务")
    if limit:
        titles = titles[:limit]
    total = len(titles)
    print(f"[quest] Category:任务 共 {total} 个页面，开始抓取...")

    items: list[dict] = []
    seen: set[str] = set()
    ok = fail = no_tpl = 0

    for title in titles:
        try:
            wikitext = api.fetch_module_wikitext(title)
            ok += 1
            q = parse_quest(title, wikitext, num=len(items) + 1)
            if q is None:
                no_tpl += 1
                continue
            if q["slug"] in seen:
                continue
            seen.add(q["slug"])
            items.append(q)
        except Exception as ex:  # noqa: BLE001
            fail += 1
            print(f"[quest]   {title!r} 失败: {ex}")

    # 按任务序号排序（seq 形如 "1_1"/"2_0001"，按字符串排序即可）
    items.sort(key=lambda x: x.get("seq", ""))

    stats = {"total_pages": total, "fetch_ok": ok, "fetch_fail": fail,
             "no_template": no_tpl, "items": len(items)}
    return items, stats


def _list_category_members(api: WikiApi, category: str) -> list[str]:
    """分页列出分类下的内容页面标题。"""
    browser_ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
    titles: list[str] = []
    cont: dict | None = None
    while True:
        api._throttle()
        data = {
            "action": "query", "list": "categorymembers", "cmtitle": category,
            "cmlimit": "500", "cmtype": "page", "format": "json", "formatversion": "2",
        }
        if cont:
            data.update(cont)
        resp = api._session.post(
            f"{api.base_url}/api.php", data=data,
            headers={"User-Agent": browser_ua, "Referer": f"{api.base_url}/"},
            timeout=api.timeout,
        )
        resp.raise_for_status()
        j = resp.json()
        titles += [m["title"] for m in j.get("query", {}).get("categorymembers", []) if m.get("title")]
        cont = j.get("continue")
        if not cont:
            break
    return titles
