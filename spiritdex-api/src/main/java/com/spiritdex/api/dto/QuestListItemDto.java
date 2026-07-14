package com.spiritdex.api.dto;

import lombok.Data;

/** 任务列表项（卡片精简投影）。 */
@Data
public class QuestListItemDto {
    private String slug;
    private String name;
    /** 旅途 / 奇谭 / 拾遗。 */
    private String category;
    private String seq;
    private String location;
    private String imageKey;
}
