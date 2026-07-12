package com.spiritdex.api.dto;

import lombok.Data;

/**
 * 精灵技能（详情页技能池条目）。
 */
@Data
public class PetSkillDto {
    private String slug;
    private String name;
    private String category;
    private String element;
    private Integer power;
    private String damageClass;
    private Integer energy;
    private String target;
    private String effectText;
    /** 学习方式：feature / native / stone / blood（Phase 1 仅 feature）。 */
    private String learnMethod;
    private Integer unlockLevel;
}
