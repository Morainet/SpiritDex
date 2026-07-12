package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "pet", autoResultMap = true)
public class Pet {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String slug;

    private String name;

    private String description;

    private String rarity;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Integer> baseStats;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> obtainMethods;

    private String sourceUrl;

    // —— Phase 1 扩展字段（V2 迁移新增列）——
    /** 图鉴编号（pet_000001 → 1）。 */
    private Integer dexNo;
    /** BWIKI 原始 key，如 pet_000001。 */
    private String catalogId;
    /** 头衔/称号。 */
    private String title;
    /** 精灵分类，如「猫咪类精灵」。 */
    private String category;
    /** 进化阶段 1/2/3。 */
    private Integer stage;
    private String height;
    private String weight;
    /** 是否可双人骑乘。 */
    private Boolean canDoubleRide;
    /** 是否有异色。 */
    private Boolean hasShiny;
    /** 立绘 key（外链用，不存图）。 */
    private String illustrationKey;
    private String headKey;
    private String eggKey;
    private String handbookId;
    private String habitat;
    /** 进化组 id，如 evo_000004。 */
    private String evolutionGroupId;

    @TableLogic
    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
