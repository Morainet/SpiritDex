package com.spiritdex.api.dto;

import lombok.Data;

import java.util.List;

/**
 * 技能详情（含「可学精灵」反查）。
 */
@Data
public class SkillDetailDto {
    private String slug;
    private String catalogId;
    private String name;
    private String category;
    private String element;
    private Integer power;
    private String damageClass;
    private Integer energy;
    private String target;
    private String effectText;
    private String flavorText;
    private String iconId;
    /** 以此技能为特性技能的精灵（简略，完整技能池待后续抓取）。 */
    private List<LearnerPet> pets;

    @Data
    public static class LearnerPet {
        private String slug;
        private String name;
    }
}
