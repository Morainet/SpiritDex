-- V17: 用户收藏表（Phase 7 第二期）
-- 收藏 = user_id + pet_slug 关联（一只精灵可被多用户收藏，一用户可收藏多只）
CREATE TABLE IF NOT EXISTS favorite (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    pet_slug    VARCHAR(64)  NOT NULL,             -- 关联 pet.slug（无 FK，逻辑关联）
    deleted     SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, pet_slug)
);
CREATE INDEX IF NOT EXISTS idx_favorite_user ON favorite (user_id);
