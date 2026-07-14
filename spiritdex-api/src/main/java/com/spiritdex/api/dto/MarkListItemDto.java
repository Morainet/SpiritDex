package com.spiritdex.api.dto;

import lombok.Data;

/** 印记列表项（卡片精简投影）。 */
@Data
public class MarkListItemDto {
    private String slug;
    private String name;
    /** 正面 / 负面。 */
    private String faction;
    private String effectText;
}
