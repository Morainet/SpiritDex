-- V9：article 表新增 AI 生成相关列
-- 支持「定时 AI 编写并发布活动攻略」功能：
--   ai_generated —— 标识该文章是否由 AI 生成（合规透明、前端可显示徽章）
--   source_url   —— 活动信息来源（BWIKI 链接，溯源）
ALTER TABLE article
    ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS source_url   VARCHAR(512);

-- AI 生成的草稿转发布时，常按「生成时间 + 状态」筛选，加一个部分索引
CREATE INDEX IF NOT EXISTS idx_article_ai_draft
    ON article (status, ai_generated, created_at)
    WHERE ai_generated = true;
