-- V7: 分离视觉向量到独立列 visual_embedding。
--
-- 背景：V6 的 vision-seed 错误地用视觉描述覆盖了文字 embedding（embedding 列）+ chunk_text，
-- 导致文字 RAG 检索被污染。本迁移：
-- 1. 新增 visual_embedding 列（专门存视觉描述的向量）
-- 2. 把当前 embedding 列里"被污染的视觉向量"迁移到 visual_embedding
-- 3. embedding 列的文字向量需由 RebuildEmbeddings（修复后重跑）恢复
--
-- 注意：被污染的 chunk_text（100条视觉描述）需 RebuildEmbeddings 从 pet 表重建文字 chunk。

ALTER TABLE embedding ADD COLUMN IF NOT EXISTS visual_embedding vector(1024);
COMMENT ON COLUMN embedding.visual_embedding IS '视觉描述的向量（图片识别专用，与文字 embedding 分离）';

-- 把已有 visual_desc 的行的当前 embedding 复制到 visual_embedding（保留视觉向量）
UPDATE embedding SET visual_embedding = embedding WHERE visual_desc IS NOT NULL;
