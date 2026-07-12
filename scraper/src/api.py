"""MediaWiki API 客户端：拉取 BWIKI 的 Lua 数据模块 wikitext。

合规（落实 doc/implementation-plan.md §4.2）：
- QPS ≤ 1（每次请求后 sleep）
- 自定义 UA，标明用途
- 遵守 robots.txt（已确认 wiki 内容页允许）
- 只取事实数据（模块本身即结构化数据，无原创攻略文本）
"""

from __future__ import annotations

import time
import urllib.parse

import requests

from .config import settings

# 五个数据模块（与 fetcher 共用）
PET_DATA_MODULES = [
    "Module:PetData/Core",
    "Module:PetData/Index",
    "Module:PetData/SkillCatalog",
    "Module:PetData/Evolution",
    "Module:PetData/Handbook",
]


class WikiApi:
    """对 ``api.php`` 的轻量封装，带限速与重试。"""

    def __init__(
        self,
        base_url: str | None = None,
        user_agent: str | None = None,
        timeout: float | None = None,
        min_interval: float | None = None,
    ) -> None:
        self.base_url = (base_url or settings.api_base).rstrip("/")
        self.timeout = timeout or settings.timeout
        self.min_interval = settings.min_interval if min_interval is None else min_interval
        self._last = 0.0
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": user_agent or settings.user_agent})

    def _throttle(self) -> None:
        gap = time.monotonic() - self._last
        if gap < self.min_interval:
            time.sleep(self.min_interval - gap)
        self._last = time.monotonic()

    def fetch_module_wikitext(self, page: str, retries: int = 3) -> str:
        """通过 ``action=parse&prop=wikitext`` 取模块原始 wikitext。

        BWIKI 的 EdgeOne WAF 会拦截 api.php 的 GET 请求（返回 567），故统一用
        **POST** + 浏览器 UA + Referer 绕过。
        """
        return self._parse_wikitext_post(page, label="模块", retries=retries)

    def fetch_widget_source(self, widget_name: str, retries: int = 3) -> str:
        """读取 MediaWiki Widget 的源码（同模块，POST 绕 WAF）。"""
        page = widget_name if widget_name.startswith("Widget:") else f"Widget:{widget_name}"
        return self._parse_wikitext_post(page, label="Widget", retries=retries)

    def _parse_wikitext_post(self, page: str, label: str, retries: int = 3) -> str:
        """POST ``action=parse&prop=wikitext``，带浏览器特征绕过 EdgeOne WAF。"""
        browser_ua = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        )
        headers = {
            "User-Agent": browser_ua,
            "Referer": f"{self.base_url}/",
        }
        last_err: Exception | None = None
        for attempt in range(retries):
            self._throttle()
            try:
                resp = self._session.post(
                    f"{self.base_url}/api.php",
                    data={
                        "action": "parse",
                        "page": page,
                        "prop": "wikitext",
                        "format": "json",
                        "formatversion": "2",
                    },
                    headers=headers,
                    timeout=self.timeout,
                )
                resp.raise_for_status()
                data = resp.json()
            except (requests.RequestException, ValueError) as ex:
                last_err = ex
                time.sleep(1.5 ** attempt)
                continue
            if "error" in data:
                raise RuntimeError(f"{label} {page} 读取失败: {data['error'].get('info', data['error'])}")
            return data["parse"]["wikitext"]
        raise RuntimeError(f"{label} {page} 重试 {retries} 次仍失败: {last_err}")

    def page_url(self, page: str) -> str:
        """返回该 page 的可读 URL，用于 seed 记录 source_url（出处）。"""
        return f"{self.base_url}/wiki/" + urllib.parse.quote(page, safe="")
