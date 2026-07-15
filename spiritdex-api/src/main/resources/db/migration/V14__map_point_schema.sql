-- V14: 地图点位表（游戏内坐标，纯展示）
-- 数据源：BWIKI Data:MapV2/type/{id}/json（游戏内平面坐标系，非真实经纬度）
CREATE TABLE IF NOT EXISTS map_point (
    id          BIGSERIAL    PRIMARY KEY,
    mark_type   INT          NOT NULL,               -- 点位类型 id（201/202/...）
    type_name   VARCHAR(64)  NOT NULL,               -- 类型中文名（庇护所/传送点/...）
    title       VARCHAR(128),                        -- 点位标题（可能为空）
    description TEXT,                                -- 点位描述
    lat         DOUBLE PRECISION NOT NULL,           -- 游戏内 y 坐标
    lng         DOUBLE PRECISION NOT NULL,           -- 游戏内 x 坐标
    deleted     SMALLINT     NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_map_point_type ON map_point (mark_type);
