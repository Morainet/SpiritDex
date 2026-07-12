package com.spiritdex.api.dto;

import lombok.Data;

import java.util.List;

/**
 * 精灵列表项（精简，不含 description 长文）。
 */
@Data
public class PetListItemDto {
    private String slug;
    private Integer dexNo;
    private String name;
    private String title;
    private Integer stage;
    /** 属性中文名，如 ["草"] 或 ["草","武"]。 */
    private List<String> types;
    /** 立绘 key（前端拼 BWIKI 外链）。 */
    private String illustrationKey;
    private String headKey;
}
