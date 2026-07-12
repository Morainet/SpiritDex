package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 精灵 ↔ 技能（带学习方式/等级）。
 * Phase 1 仅 feature_skill（learn_method=feature）；完整技能池后续补抓。
 */
@Data
@TableName("pet_skill")
public class PetSkill {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long petId;

    private Long skillId;

    /** 学习等级（feature_skill 为 null）。 */
    private Integer unlockLevel;

    /** feature / native / stone / blood。 */
    private String learnMethod;

    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
