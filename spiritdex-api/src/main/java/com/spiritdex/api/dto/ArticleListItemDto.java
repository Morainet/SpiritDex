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
}
