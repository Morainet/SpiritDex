package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 进化链（evolution_chain）—— 264 条，来自 BWIKI Evolution 模块。
 * 各阶段见 {@link EvolutionStage}。
 */
@Data
@TableName("evolution_chain")
public class EvolutionChain {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** BWIKI 原始 key，如 evo_000001。 */
    private String groupId;

    private String name;

    private Integer stageCount;

    private String sourceUrl;

    @TableLogic
    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
