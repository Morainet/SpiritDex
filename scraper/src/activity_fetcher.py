"""活动公告抓取器：从 BWIKI 拉取首页/活动相关页面，提取活动信息。

产物 ``data/seed/activities.json``，结构与其他 seed 文件一致::

    {"meta": {...}, "items": [{"name", "start", "end", "source_url", "raw_text"}]}

供后端 ``ArticleGenerationService`` 读取 → 调 GLM 扩写成活动攻略。

合规：复用 ``WikiApi``（QPS≤1、UA、POST 绕 WAF）；只提取活动名称/时间/链接等
事实信息，不搬运原创攻略正文。

⚠️ 诚实说明：BWIKI 首页活动板块的 wikitext 结构未实测，可能用 ``{{模板}}`` 或
纯文本。本模块采用「多策略容错」：
1. 优先解析常见活动模板调用（``{{...公告...}}``、``{{活动}}``）
2. 回退用 ``action=query&list=search&srsearch=活动`` 找活动相关页面
3. 最终兜底：取首页前若干段文本作为 raw_text，交给 LLM 自摘

任一策略失败都不抛异常，返回空列表由后端用 fallback-topics 兜底。
"""

from __future__ import annotations

import re
import urllib.parse
from dataclasses import dataclass

from .api import WikiApi
from .config import settings


@dataclass
class Activity:
    """单条活动信息。"""
    name: str
    start: str | None = None
    end: str | None = None
    source_url: str | None = None
    raw_text: str | None = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "start": self.start,
            "end": self.end,
            "source_url": self.source_url,
            "raw_text": self.raw_text,
        }


def fetch_activities(api: WikiApi, max_items: int = 10) -> list[dict]:
    """抓取最新活动，返回 items 列表（已 to_dict）。

    多策略容错：任一策略失败回退到下一个。
    """
    strategies = [
        _from_homepage_templates,
        _from_search,
    ]
    for strategy in strategies:
        try:
            items = strategy(api, max_items)
            if items:
                return items[:max_items]
        except Exception as ex:  # noqa: BLE001 —— 任一策略失败回退下一个
            print(f"[activity] 策略 {strategy.__name__} 失败: {ex}")
    print("[activity] 所有策略均未取到活动，返回空列表（后端将用 fallback topics）")
    return []


def _from_homepage_templates(api: WikiApi, max_items: int) -> list[dict]:
    """策略 1：拉首页 wikitext，解析活动模板调用 + 文本段落。"""
    wikitext = api.fetch_module_wikitext("首页")
    activities = _parse_homepage(wikitext, api)
    if not activities:
        # 首页无显式活动模板：取首页部分文本作为 raw，名字用「最新活动」占位
        snippet = _strip_wiki_markup(wikitext)[:500]
        if snippet.strip():
            activities = [Activity(
                name="最新游戏活动",
                source_url=api.page_url("首页"),
                raw_text=snippet,
            )]
    return [a.to_dict() for a in activities]


def _parse_homepage(wikitext: str, api: WikiApi) -> list[Activity]:
    """从首页 wikitext 提取活动。容错：尽力提取，结构不符返回空。"""
    activities: list[Activity] = []
    seen_names: set[str] = set()

    # 策略 A：匹配活动相关模板调用 {{模板名|参数1|参数2|...}}
    # 常见模板名：活动、活动公告、最新活动、限时活动、首页活动
    template_re = re.compile(
        r"\{\{\s*([^|}]*?(?:活动|公告)[^|}]*?)\s*((?:\|[^{}]*)?)\}\}",
        re.DOTALL,
    )
    for m in template_re.finditer(wikitext):
        params = _parse_template_params(m.group(2))
        name = (
            params.get("name") or params.get("title") or params.get("活动")
            or params.get("1") or (params.get("_positional", [None])[0] if params.get("_positional") else None)
        )
        if not name:
            # 模板名本身可能就是活动名（无参数的简单标记）
            continue
        name = name.strip()
        if not name or name in seen_names:
            continue
        seen_names.add(name)
        activities.append(Activity(
            name=name,
            start=params.get("start") or params.get("开始"),
            end=params.get("end") or params.get("结束"),
            source_url=api.page_url(name) if _looks_like_page(name) else api.page_url("首页"),
            raw_text=m.group(0)[:400],
        ))
        if len(activities) >= max_items_default:
            break

    # 策略 B：匹配 wiki 链接 [[页面名]] 中含「活动」二字的
    if len(activities) < max_items_default:
        link_re = re.compile(r"\[\[([^\]|]+?活动[^\]|]*?)(?:\|[^\]]*)?\]\]")
        for m in link_re.finditer(wikitext):
            name = m.group(1).strip()
            if name in seen_names:
                continue
            seen_names.add(name)
            activities.append(Activity(
                name=name,
                source_url=api.page_url(name),
            ))
            if len(activities) >= max_items_default:
                break

    return activities


def _parse_template_params(params_str: str) -> dict:
    """解析模板参数字符串 ``|a|b|name=c`` → {positional:[a,b], name:c}。"""
    params: dict = {}
    positional: list[str] = []
    if not params_str:
        return params
    # 按竖心分割（简化：不处理嵌套模板内的 |，活动模板通常无嵌套）
    parts = [p.strip() for p in params_str.strip().strip("|").split("|") if p.strip()]
    for i, part in enumerate(parts):
        if "=" in part:
            k, v = part.split("=", 1)
            params[k.strip()] = v.strip()
        else:
            positional.append(part)
            params[str(i + 1)] = part
    if positional:
        params["_positional"] = positional
    return params


def _from_search(api: WikiApi, max_items: int) -> list[dict]:
    """策略 2：用 search 接口搜「活动」相关页面。"""
    search_url = f"{api.base_url}/api.php"
    browser_ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
    api._throttle()
    resp = api._session.post(
        search_url,
        data={
            "action": "query",
            "list": "search",
            "srsearch": "活动",
            "srlimit": str(max_items),
            "srnamespace": "0",
            "format": "json",
            "formatversion": "2",
        },
        headers={"User-Agent": browser_ua, "Referer": f"{api.base_url}/"},
        timeout=api.timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("query", {}).get("search", [])
    activities: list[dict] = []
    for r in results:
        title = r.get("title", "").strip()
        if not title:
            continue
        # 去除 search snippet 里的 HTML 标签
        snippet = _strip_html(r.get("snippet", ""))
        activities.append({
            "name": title,
            "source_url": api.page_url(title),
            "raw_text": snippet[:400] if snippet else None,
        })
    return activities


def _strip_wiki_markup(text: str) -> str:
    """粗略去除 wiki 标记（模板/链接/标题符号），保留纯文本。"""
    text = re.sub(r"\{\{[^}]*\}\}", "", text, flags=re.DOTALL)  # 模板
    text = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]*)\]\]", r"\1", text)  # 链接
    text = re.sub(r"'+", "", text)  # 加粗/斜体
    text = re.sub(r"^=+\s*.*?\s*=+$", "", text, flags=re.MULTILINE)  # 标题
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _strip_html(text: str) -> str:
    """去除 HTML 标签（search snippet 里的高亮标记）。"""
    return re.sub(r"<[^>]+>", "", text).replace("&amp;", "&")


def _looks_like_page(name: str) -> bool:
    """判断字符串是否像 wiki 页面名（非纯数字/符号）。"""
    return bool(name) and any(c.isalnum() for c in name) and " " not in name


# 模块级默认值（_parse_homepage 内部策略 B 用），保持与 fetch_activities 入参解耦
max_items_default = 10
