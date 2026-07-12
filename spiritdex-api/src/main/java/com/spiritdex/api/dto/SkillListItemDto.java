package com.spiritdex.api.dto;

import lombok.Data;

/**
 * 技能列表项（精简）。
 */
@Data
public class SkillListItemDto {
    private String slug;
    private String name;
    private String category;
    private String element;
    private Integer power;
    private String damageClass;
    private Integer energy;
    private String iconId;
}
