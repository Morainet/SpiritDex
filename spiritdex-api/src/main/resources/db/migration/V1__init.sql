-- V1: 初始化 schema，建精灵主表 + seed 2 条假数据
-- 完整字段（属性、进化链、技能关联等）在后续 Phase 1/2 迁移补齐

CREATE TABLE IF NOT EXISTS pet (
    id              BIGSERIAL PRIMARY KEY,
    slug            VARCHAR(64)  NOT NULL UNIQUE,
    name            VARCHAR(64)  NOT NULL,
    description     TEXT,
    rarity          VARCHAR(32),
    base_stats      JSONB,
    obtain_methods  JSONB,
    source_url      VARCHAR(512),
    deleted         SMALLINT     NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_name ON pet (name);
CREATE INDEX IF NOT EXISTS idx_pet_rarity ON pet (rarity);

-- Phase 0 假数据：用于打通前后端联通
INSERT INTO pet (slug, name, description, rarity, base_stats, obtain_methods) VALUES
    ('demo-pet-alpha', '演示精灵·甲', 'Phase 0 联通测试用的假数据，后续由 scraper 替换',
     '普通', '{"hp": 45, "atk": 55, "def": 40, "spd": 50}'::jsonb,
     '["新手赠送"]'::jsonb),
    ('demo-pet-beta', '演示精灵·乙', 'Phase 0 联通测试用的假数据，后续由 scraper 替换',
     '稀有', '{"hp": 60, "atk": 70, "def": 55, "spd": 65}'::jsonb,
     '["副本掉落","活动奖励"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;
