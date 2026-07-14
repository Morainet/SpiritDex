package com.spiritdex.api.dto;

import lombok.Data;

/** 任务详情（全字段，纯展示无嵌套关联）。 */
@Data
public class QuestDetailDto {
    private String slug;
    private String catalogId;
    private String name;
    private String seq;
    private String category;
    private String location;
    private String description;
    private String reward;
    private String imageKey;
    private String note;
    private String attribution;
    private String sourceUrl;
}
