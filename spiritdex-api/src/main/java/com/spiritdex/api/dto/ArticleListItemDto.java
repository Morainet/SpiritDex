package com.spiritdex.api.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 文章列表项（不含正文）。
 */
@Data
public class ArticleListItemDto {
    private String slug;
    private String title;
    private String summary;
    private String category;
    private String coverImage;
    private List<String> tags;
    private String authorName;
    private LocalDateTime createdAt;
    /** 是否 AI 生成（前端可显示「AI」徽章）。 */
    private Boolean aiGenerated;
}
