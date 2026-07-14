package com.spiritdex.api.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/** 印记详情（全字段）。source_skills 是列表 [{name, desc}]。 */
@Data
public class MarkDetailDto {
    private String slug;
    private String catalogId;
    private String name;
    private String faction;
    private String effectText;
    private String mechanics;
    /** 可施加技能 [{name, desc}]。 */
    private List<Map<String, Object>> sourceSkills;
    private String sourceUrl;
}
