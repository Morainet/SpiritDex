-- V5: AI 向量嵌入表（pgvector）
--
-- 用于 RAG 检索：把精灵文本（名字+属性+描述）生成 1024 维向量，问答时余弦相似度召回。
-- 用自建表 + MyBatis 查询（非 Spring AI VectorStore 抽象），便于关联具体精灵渲染「回答来源」。
-- embedding-3 默认 2048 维，调用时传 dimensions=1024 降维（省存储、与方案 §三一致）。

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS embedding (
    id           BIGSERIAL    PRIMARY KEY,
    entity_type  VARCHAR(32)  NOT NULL,           -- pet
    entity_id    BIGINT       NOT NULL,
    slug         VARCHAR(64),
    chunk_text   TEXT,                             -- 被嵌入的文本块（便于回看/调试）
    embedding    vector(1024),
    model        VARCHAR(64),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (entity_type, entity_id)
);

-- ivfflat 余弦距离索引；lists 按 sqrt(行数)≈26 取 100 留余量。
CREATE INDEX IF NOT EXISTS idx_embedding_vec
    ON embedding USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_embedding_entity ON embedding (entity_type, entity_id);
