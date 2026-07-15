package com.spiritdex.api.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.spiritdex.api.entity.MapPoint;
import org.apache.ibatis.annotations.Mapper;

/** 地图点位 Mapper（纯展示，无自定义 SQL）。 */
@Mapper
public interface MapPointMapper extends BaseMapper<MapPoint> {
}
