-- V13: 精灵分布地区关联表（多对多，仿 pet_type）
-- 数据源：精灵页面级 {{精灵信息/兼容|分布地区=地名1/地名2/...}} 模板
-- 与 pet.habitat（生态描述）不同，这是具体游戏地名
CREATE TABLE IF NOT EXISTS pet_location (
    id          BIGSERIAL    PRIMARY KEY,
    pet_id      BIGINT       NOT NULL,
    location    VARCHAR(128) NOT NULL,            -- 游戏内地名（岚语峰/月牙镇/...）
    deleted     SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (pet_id, location)
);
CREATE INDEX IF NOT EXISTS idx_pet_location_pet      ON pet_location (pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_location_location ON pet_location (location);
