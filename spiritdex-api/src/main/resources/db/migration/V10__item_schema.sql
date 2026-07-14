-- V10: 道具图鉴表（纯展示，无关联）
-- 数据源：BWIKI Category:道具 页面级 {{物品信息}} 模板（约 1780 条）
-- 字段映射见 scraper/src/item_fetcher.py
CREATE TABLE IF NOT EXISTS item (
    id            BIGSERIAL    PRIMARY KEY,
    slug          VARCHAR(64)  NOT NULL UNIQUE,          -- item-0001（按抓取顺序，稳定）
    catalog_id    VARCHAR(128) NOT NULL UNIQUE,          -- BWIKI 页面名（稳定唯一）
    name          VARCHAR(128) NOT NULL,
    rarity        VARCHAR(16),                            -- 紫 / 蓝 / 橙 / 绿
    main_category VARCHAR(32),                            -- 材料 / 技能石 / 重要 / 精灵蛋 / 精灵果实 / 任务 / 家具 / 咕噜球
    sub_category  VARCHAR(64),
    usage_text    TEXT,                                   -- 用途
    description   TEXT,                                   -- 描述（多为空）
    source_text   TEXT,                                   -- 来源（自由文本）
    icon_id       VARCHAR(64),
    data_version  VARCHAR(16),                            -- 道具版本（0.1 / 0.2）
    source_url    VARCHAR(512),
    deleted       SMALLINT     NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_item_name          ON item (name);
CREATE INDEX IF NOT EXISTS idx_item_main_category ON item (main_category);
CREATE INDEX IF NOT EXISTS idx_item_rarity        ON item (rarity);
