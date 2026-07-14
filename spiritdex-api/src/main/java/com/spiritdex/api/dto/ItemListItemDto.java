package com.spiritdex.api.dto;

import lombok.Data;

/**
 * 道具列表项（卡片精简投影）。
 */
@Data
public class ItemListItemDto {
    private String slug;
    private String name;
    /** 紫 / 蓝 / 橙 / 绿。 */
    private String rarity;
    private String mainCategory;
    private String subCategory;
    private String iconId;
}
