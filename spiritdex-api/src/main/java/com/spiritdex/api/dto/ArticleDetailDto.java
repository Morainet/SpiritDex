package com.spiritdex.api.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 文章详情（含 Markdown 正文）。
 */
@Data
public class ArticleDetailDto {
    private String slug;
    private String title;
    private String summary;
    /** Markdown 正文。 */
    private String content;
    private String category;
    private String coverImage;
    private List<String> tags;
    private String authorName;
    private Integer viewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
