"""把 transformed items 写成 ``data/seed/*.json``。

每个文件统一结构::

    {"meta": {"source", "source_url", "scraped_at", "count"}, "items": [...]}

seed 目录由 ``config.settings.seed_dir`` 决定（默认项目根 data/seed）。
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from .config import settings


def write_all(all_items: dict[str, list[dict]], seed_dir: str | None = None) -> dict[str, str]:
    """写出全部 seed 文件，返回 ``{filename: abspath}``。"""
    out_dir = seed_dir or settings.seed_dir
    os.makedirs(out_dir, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    written: dict[str, str] = {}
    for name, items in all_items.items():
        payload = {
            "meta": {
                "source": settings.source_name,
                "source_url": settings.source_module_url,
                "scraped_at": now,
                "count": len(items),
            },
            "items": items,
        }
        path = os.path.join(out_dir, f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        written[name] = path
    return written
