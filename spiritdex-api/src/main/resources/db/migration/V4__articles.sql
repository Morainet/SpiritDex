-- V4: 攻略文章表（article）
--
-- 设计：正文存 Markdown（前端 react-markdown 渲染）；预留 author_id 待 Phase 7
-- 账号体系接入；Phase 3 用 SeedRunner 导入，author_name 用「灵宠档案编辑部」。
-- 约定：deleted SMALLINT（全局逻辑删除）+ created_at/updated_at（沿用）。

CREATE TABLE IF NOT EXISTS article (
    id           BIGSERIAL    PRIMARY KEY,
    slug         VARCHAR(128) NOT NULL UNIQUE,   -- URL 基石
    title        VARCHAR(200) NOT NULL,
    summary      VARCHAR(500),                   -- 摘要（列表展示）
    content      TEXT         NOT NULL,          -- Markdown 正文
    cover_image  VARCHAR(512),
    category     VARCHAR(32),                    -- 新手 / 进阶 / 活动 ...
    tags         JSONB,                          -- ["新手","火系"]
    author_id    BIGINT,                         -- 预留：Phase 7 指向 user 表
    author_name  VARCHAR(64)  NOT NULL DEFAULT '灵宠档案编辑部',
    status       VARCHAR(16)  NOT NULL DEFAULT 'published',  -- draft / published
    view_count   INT          NOT NULL DEFAULT 0,
    deleted      SMALLINT     NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_category ON article (category);
CREATE INDEX IF NOT EXISTS idx_article_status   ON article (status);
CREATE INDEX IF NOT EXISTS idx_article_created  ON article (created_at DESC);
