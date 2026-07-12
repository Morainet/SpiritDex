package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 进化阶段（evolution_stage）—— 611 条。
 * 属于某条 {@link EvolutionChain}；指向某个 pet（catalog_id 兜底，pet_id 可为 null）。
 */
@Data
@TableName(value = "evolution_stage", autoResultMap = true)
public class EvolutionStage {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long chainId;

    private Integer stageNo;

    private Long petId;

    /** BWIKI 原始 key（pet_000002），pet_id 为 null 时兜底关联。 */
    private String petCatalogId;

    private String petName;

    private String petTitle;

    /** 进化所需等级（首阶无）。 */
    private Integer level;

    /** 进化条件（非等级进化）。 */
    private String cond;

    private String form;

    /** 阶段属性，如 ["水"]。 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> types;

    private String headKey;

    private String illustrationKey;

    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
