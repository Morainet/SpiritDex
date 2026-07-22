-- V15: 地图点位表升级（加 icon / layer 字段，支持 Mapnew 数据源）
ALTER TABLE map_point ADD COLUMN IF NOT EXISTS icon  VARCHAR(256);   -- icon 文件名（Special:FilePath 用）
ALTER TABLE map_point ADD COLUMN IF NOT EXISTS layer VARCHAR(16) DEFAULT 'G';  -- 图层

-- 文字图层表（地名标注：洛克里安 / 魔法师之家 等）
CREATE TABLE IF NOT EXISTS map_text_layer (
    id          BIGSERIAL    PRIMARY KEY,
    text        VARCHAR(128) NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    layer       VARCHAR(16)  DEFAULT 'G',
    min_zoom    INT,
    max_zoom    INT,
    deleted     SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
