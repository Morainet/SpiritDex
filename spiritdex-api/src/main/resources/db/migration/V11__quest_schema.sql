-- V11: 任务图鉴表（纯展示，无关联）
-- 数据源：BWIKI Category:任务 页面级 {{任务信息}} 模板（约 18 条）
CREATE TABLE IF NOT EXISTS quest (
    id            BIGSERIAL    PRIMARY KEY,
    slug          VARCHAR(64)  NOT NULL UNIQUE,          -- quest-0001
    catalog_id    VARCHAR(128) NOT NULL UNIQUE,          -- 任务名称（稳定唯一）
    name          VARCHAR(128) NOT NULL,
    seq           VARCHAR(32),                            -- 任务序号（如 1_1、2_0001）
    category      VARCHAR(32),                            -- 旅途 / 奇谭 / 拾遗
    location      VARCHAR(128),                           -- 任务地点
    description   TEXT,                                   -- 任务描述（叙事文本）
    reward        TEXT,                                   -- 任务奖励
    image_key     VARCHAR(64),                            -- 任务图片 key（背景1~4）
    note          TEXT,                                   -- 任务备注
    attribution   VARCHAR(128),                           -- 任务归属
    source_url    VARCHAR(512),
    deleted       SMALLINT     NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quest_name     ON quest (name);
CREATE INDEX IF NOT EXISTS idx_quest_category ON quest (category);
