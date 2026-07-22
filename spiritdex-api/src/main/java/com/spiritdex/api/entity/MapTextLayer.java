package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 地图文字图层（地名标注：洛克里安 / 魔法师之家 等）。
 */
@Data
@TableName("map_text_layer")
public class MapTextLayer {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String text;
    private Double lat;
    private Double lng;
    private String layer;
    private Integer minZoom;
    private Integer maxZoom;

    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
