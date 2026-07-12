"""scraper 运行配置。

所有值可用环境变量覆盖，便于 CI / 本地不同环境运行。
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class _Settings:
    # BWIKI「洛克王国:手游」站点
    api_base: str = os.getenv("SPIRITDEX_WIKI_BASE", "https://wiki.biligame.com/rocom")
    # 自定义 UA，标明用途（合规）。HTTP header 仅允许 ASCII，故不含中文。
    user_agent: str = os.getenv(
        "SPIRITDEX_UA", "SpiritDexWikiBot/0.1 (+SpiritDex Roco-Kingdom-mobile fan guide; research; respectful crawler)"
    )
    # QPS ≤ 1：两次请求最小间隔（秒）
    min_interval: float = float(os.getenv("SPIRITDEX_MIN_INTERVAL", "1.0"))
    # 单请求超时（秒）
    timeout: float = float(os.getenv("SPIRITDEX_TIMEOUT", "40"))
    # 产物输出目录（项目根 data/seed）
    seed_dir: str = os.getenv(
        "SPIRITDEX_SEED_DIR",
        os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "seed")),
    )
    # 真实数据来源页（用于 seed 记录 source）
    source_name: str = "BWIKI 洛克王国:手游WIKI"
    source_module_url: str = "https://wiki.biligame.com/rocom/wiki/Module:PetData/Core"


settings = _Settings()
