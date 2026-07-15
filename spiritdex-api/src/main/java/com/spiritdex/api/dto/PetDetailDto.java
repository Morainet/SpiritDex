package com.spiritdex.api.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 精灵详情（聚合：属性 / 技能 / 进化链）。
 */
@Data
public class PetDetailDto {
    private String slug;
    private Integer dexNo;
    private String name;
    private String title;
    private String description;
    private String category;
    private Integer stage;
    private List<String> types;
    /** 种族值 {hp,atk,def,spa,sdf,spe}。 */
    private Map<String, Integer> baseStats;
    private String height;
    private String weight;
    private Boolean canDoubleRide;
    private Boolean hasShiny;
    private String habitat;
    private String illustrationKey;
    private String headKey;
    private String evolutionGroupId;
    private List<PetSkillDto> skills;
    /** 分布地区（游戏内地名列表，来自页面级「分布地区」字段）。 */
    private List<String> locations;
    private EvolutionChainDto evolution;
}
