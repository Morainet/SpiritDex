package com.spiritdex.api.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 精灵精简数据（工具页用：种族值 + 属性 + 基础信息）。
 * 用于伤害计算器/性格计算器等需要全量精灵种族值的场景，替代逐个查详情（消除 N+1）。
 */
@Data
public class PetStatsDto {
    private String slug;
    private Integer dexNo;
    private String name;
    private Integer stage;
    private List<String> types;
    /** 种族值 {hp,atk,def,spa,sdf,spe}。 */
    private Map<String, Integer> baseStats;
    private String headKey;
}
