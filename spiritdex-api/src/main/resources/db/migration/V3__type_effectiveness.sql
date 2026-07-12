-- V3: 属性相克矩阵（type_effectiveness）
--
-- 设计：行 = 攻击方属性，列 = 防御方属性，值 = 倍率（1=正常/2=克制/0.5=被克/0=无效）。
-- 用 (attacking_type_id, defending_type_id) 复合唯一键，支持双向查询：
--   - 「火打谁 2x」：where attacking_type_id=? and multiplier>1
--   - 「火被谁克制」：where defending_type_id=? and multiplier>1
-- 仅记录非 1（非正常）的条目，减少行数；查询时未命中即视为 1.0。
--
-- 数据来源：洛克王国手游 18 属性经典相克关系，待人工校对后由 SeedRunner 填充
-- （见 data/seed/type_effectiveness.json，可空，Phase 1 先搭结构）。

CREATE TABLE IF NOT EXISTS type_effectiveness (
    id                 BIGSERIAL     PRIMARY KEY,
    attacking_type_id  BIGINT        NOT NULL,
    defending_type_id  BIGINT        NOT NULL,
    multiplier         NUMERIC(4,2)  NOT NULL,   -- 0 / 0.5 / 1 / 2
    source_url         VARCHAR(512),
    deleted            SMALLINT      NOT NULL DEFAULT 0,
    created_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (attacking_type_id, defending_type_id)
);
CREATE INDEX IF NOT EXISTS idx_te_atk ON type_effectiveness (attacking_type_id);
CREATE INDEX IF NOT EXISTS idx_te_def ON type_effectiveness (defending_type_id);
