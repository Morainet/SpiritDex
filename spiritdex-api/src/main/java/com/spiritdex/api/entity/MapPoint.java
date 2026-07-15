package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 地图点位实体。来自 BWIKI Data:MapV2 坐标数据（游戏内平面坐标系）。
 */
@Data
@TableName("map_point")
public class MapPoint {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 点位类型 id（201=庇护所...）。 */
    private Integer markType;
    /** 类型中文名。 */
    private String typeName;
    private String title;
    private String description;
    /** 游戏内 y 坐标。 */
    private Double lat;
    /** 游戏内 x 坐标。 */
    private Double lng;

    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
