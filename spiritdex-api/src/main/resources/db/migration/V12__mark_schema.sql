-- V12: 印记图鉴表（战斗印记系统，纯展示）
-- 数据源：BWIKI「印记」总览页 + 各独立页（约 13 条，正面8+负面5）
-- 注意：source_skills 是 JSONB 数组（[{name, desc}, ...]）
CREATE TABLE IF NOT EXISTS mark (
    id            BIGSERIAL    PRIMARY KEY,
    slug          VARCHAR(64)  NOT NULL UNIQUE,          -- mark-0001
    catalog_id    VARCHAR(64)  NOT NULL UNIQUE,          -- 印记名（稳定唯一）
    name          VARCHAR(64)  NOT NULL,
    faction       VARCHAR(16),                            -- 正面 / 负面
    effect_text   TEXT,                                   -- 基础效果
    mechanics     TEXT,                                   -- 机制说明（含 wiki 标记）
    source_skills JSONB,                                  -- 可施加技能 [{name, desc}]
    source_url    VARCHAR(512),
    deleted       SMALLINT     NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mark_name    ON mark (name);
CREATE INDEX IF NOT EXISTS idx_mark_faction ON mark (faction);
