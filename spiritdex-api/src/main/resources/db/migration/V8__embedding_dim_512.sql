-- V8: 切换 embedding 维度 1024 → 512（改用本地 bge-small-zh-v1.5）
--
-- 背景：embedding 改用本地 sentence-transformers（bge-small-zh，512 维，免费），
-- 与智谱 embedding-3（1024 维）向量空间不兼容，必须重建。
-- 本迁移：删旧向量列重建为 512 维，数据由 rebuild-text 重新填充。

DROP INDEX IF EXISTS idx_embedding_vec;
ALTER TABLE embedding DROP COLUMN IF EXISTS embedding;
ALTER TABLE embedding DROP COLUMN IF EXISTS visual_embedding;
ALTER TABLE embedding ADD COLUMN embedding vector(512);
ALTER TABLE embedding ADD COLUMN visual_embedding vector(512);

CREATE INDEX idx_embedding_vec
    ON embedding USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
