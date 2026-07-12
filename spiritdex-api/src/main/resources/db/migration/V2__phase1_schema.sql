-- V2: Phase 1 完整数据 schema —— 技能 / 属性 / 精灵扩展 / 关联表 / 进化链
-- 配合 SeedRunner 从 data/seed/*.json 导入真实数据（671 精灵 / 737 技能 / 264 进化链）。
-- 约定（沿用 V1）：每表带 deleted SMALLINT NOT NULL DEFAULT 0（满足全局逻辑删除）+
--   created_at/updated_at。slug 全局唯一稳定，作详情页 URL 基石。

-- ============ 1. type 属性表（18 个枚举，由 SeedRunner 写入）============
CREATE TABLE IF NOT EXISTS type (
    id          BIGSERIAL    PRIMARY KEY,
    slug        VARCHAR(32)  NOT NULL UNIQUE,
    name        VARCHAR(16)  NOT NULL,          -- 中文「草」
    name_en     VARCHAR(32),
    sort_order  INT,
    color       VARCHAR(16),
    icon        VARCHAR(128),
    source_url  VARCHAR(512),
    deleted     SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============ 2. skill 技能表 ============
CREATE TABLE IF NOT EXISTS skill (
    id            BIGSERIAL    PRIMARY KEY,
    slug          VARCHAR(64)  NOT NULL UNIQUE,  -- skill-0001
    catalog_id    VARCHAR(32)  NOT NULL UNIQUE,  -- skill_000001（BWIKI 原始 key）
    catalog_num   INT,
    name          VARCHAR(64)  NOT NULL,
    category      VARCHAR(32),                   -- 特性 / 攻击 / ...
    element       VARCHAR(32),                   -- 属性名（关联 type.name）
    power         INT,
    damage_class  VARCHAR(32),                   -- 物攻 / 魔攻
    energy        INT,
    target        VARCHAR(32),
    effect_text   TEXT,                          -- 技能描述
    flavor_text   TEXT,
    icon_id       VARCHAR(32),
    source_url    VARCHAR(512),
    deleted       SMALLINT     NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_name     ON skill (name);
CREATE INDEX IF NOT EXISTS idx_skill_element  ON skill (element);
CREATE INDEX IF NOT EXISTS idx_skill_category ON skill (category);

-- ============ 3. pet 扩展列（pet 表已在 V1 创建，此处 ALTER ADD）============
ALTER TABLE pet ADD COLUMN IF NOT EXISTS dex_no              INT;          -- 图鉴编号
ALTER TABLE pet ADD COLUMN IF NOT EXISTS catalog_id          VARCHAR(32);  -- pet_000001
ALTER TABLE pet ADD COLUMN IF NOT EXISTS title               VARCHAR(64);  -- 头衔/称号
ALTER TABLE pet ADD COLUMN IF NOT EXISTS category            VARCHAR(64);  -- 猫咪类精灵
ALTER TABLE pet ADD COLUMN IF NOT EXISTS stage               SMALLINT;     -- 1/2/3 阶
ALTER TABLE pet ADD COLUMN IF NOT EXISTS height              VARCHAR(32);
ALTER TABLE pet ADD COLUMN IF NOT EXISTS weight              VARCHAR(32);
ALTER TABLE pet ADD COLUMN IF NOT EXISTS can_double_ride     BOOLEAN;
ALTER TABLE pet ADD COLUMN IF NOT EXISTS has_shiny           BOOLEAN;      -- 异色
ALTER TABLE pet ADD COLUMN IF NOT EXISTS illustration_key    VARCHAR(64);  -- 立绘 key（外链用）
ALTER TABLE pet ADD COLUMN IF NOT EXISTS head_key            VARCHAR(64);
ALTER TABLE pet ADD COLUMN IF NOT EXISTS egg_key             VARCHAR(64);
ALTER TABLE pet ADD COLUMN IF NOT EXISTS handbook_id         VARCHAR(32);
ALTER TABLE pet ADD COLUMN IF NOT EXISTS habitat             TEXT;
ALTER TABLE pet ADD COLUMN IF NOT EXISTS evolution_group_id  VARCHAR(32);  -- evo_000004
CREATE INDEX IF NOT EXISTS idx_pet_dex_no     ON pet (dex_no);
CREATE INDEX IF NOT EXISTS idx_pet_catalog_id ON pet (catalog_id);
CREATE INDEX IF NOT EXISTS idx_pet_stage      ON pet (stage);

-- ============ 4. pet_type（精灵 ↔ 属性 多对多）============
CREATE TABLE IF NOT EXISTS pet_type (
    id        BIGSERIAL  PRIMARY KEY,
    pet_id    BIGINT     NOT NULL,
    type_id   BIGINT     NOT NULL,
    slot      SMALLINT   NOT NULL DEFAULT 1,    -- 主属性=1，副属性=2
    deleted   SMALLINT   NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (pet_id, type_id)
);
CREATE INDEX IF NOT EXISTS idx_pet_type_pet  ON pet_type (pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_type_type ON pet_type (type_id);

-- ============ 5. pet_skill（精灵 ↔ 技能，带学习方式/等级）============
CREATE TABLE IF NOT EXISTS pet_skill (
    id            BIGSERIAL   PRIMARY KEY,
    pet_id        BIGINT      NOT NULL,
    skill_id      BIGINT      NOT NULL,
    unlock_level  INT,                          -- 学习等级（本 Phase 仅 feature_skill，为 null）
    learn_method  VARCHAR(32),                  -- feature / native / stone / blood
    deleted       SMALLINT     NOT NULL DEFAULT 0,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (pet_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_pet_skill_pet   ON pet_skill (pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_skill_skill ON pet_skill (skill_id);

-- ============ 6. evolution_chain 进化链 + evolution_stage 阶段 ============
CREATE TABLE IF NOT EXISTS evolution_chain (
    id           BIGSERIAL    PRIMARY KEY,
    group_id     VARCHAR(32)  NOT NULL UNIQUE,   -- evo_000001（BWIKI 原始 key）
    name         VARCHAR(128),
    stage_count  INT,
    source_url   VARCHAR(512),
    deleted      SMALLINT     NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evolution_stage (
    id               BIGSERIAL    PRIMARY KEY,
    chain_id         BIGINT       NOT NULL,
    stage_no         INT          NOT NULL,
    pet_id           BIGINT,                       -- 可能为 null（BWIKI 中存在但 pet 表暂缺）
    pet_catalog_id   VARCHAR(32),                  -- pet_000002（兜底关联）
    pet_name         VARCHAR(64),
    pet_title        VARCHAR(64),
    level            INT,                          -- 进化所需等级（首阶无）
    cond             VARCHAR(128),                 -- 进化条件
    form             VARCHAR(64),
    types            JSONB,                        -- ["水"]
    head_key         VARCHAR(64),
    illustration_key VARCHAR(64),
    deleted          SMALLINT      NOT NULL DEFAULT 0,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, stage_no)
);
CREATE INDEX IF NOT EXISTS idx_evo_stage_chain ON evolution_stage (chain_id);
CREATE INDEX IF NOT EXISTS idx_evo_stage_pet   ON evolution_stage (pet_id);

-- ============ 备注 ============
-- 属性相克矩阵（type_effectiveness）见 V3__type_effectiveness.sql（表结构已搭建）。
-- 相克数据由 Phase 4 scraper 从 BWIKI Widget:RestrainCalc.js 抓取并入库。
