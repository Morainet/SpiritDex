package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 技能（skill）—— 737 个，来自 BWIKI SkillCatalog。
 */
@Data
@TableName("skill")
public class Skill {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** skill-0001（连续稳定编号）。 */
    private String slug;

    /** BWIKI 原始 key，如 skill_000001。 */
    private String catalogId;

    /** 目录连续编号（1, 2, ...）。 */
    private Integer catalogNum;

    private String name;

    /** 特性 / 攻击 / ... */
    private String category;

    /** 属性名（关联 type.name），如「草」。 */
    private String element;

    private Integer power;

    /** 物攻 / 魔攻。 */
    private String damageClass;

    private Integer energy;

    private String target;

    /** 技能描述。 */
    private String effectText;

    private String flavorText;

    private String iconId;

    private String sourceUrl;

    @TableLogic
    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
