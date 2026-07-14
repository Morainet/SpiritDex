package com.spiritdex.api.dto;

import lombok.Data;

/**
 * 道具详情（全字段，纯展示无嵌套关联）。
 */
@Data
public class ItemDetailDto {
    private String slug;
    private String catalogId;
    private String name;
    private String rarity;
    private String mainCategory;
    private String subCategory;
    private String usageText;
    private String description;
    private String sourceText;
    private String iconId;
    private String dataVersion;
    private String sourceUrl;
}
