package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 攻略文章（article）—— Markdown 正文，预留 author_id 待 Phase 7 账号体系。
 */
@Data
@TableName(value = "article", autoResultMap = true)
public class Article {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String slug;

    private String title;

    private String summary;

    /** Markdown 正文。 */
    private String content;

    private String coverImage;

    private String category;

    /** 标签 JSONB，如 ["新手","火系"]。 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;

    /** 预留：Phase 7 指向 user 表。 */
    private Long authorId;

    private String authorName;

    /** draft / published。 */
    private String status;

    /** 是否 AI 生成（活动攻略定时生成）。 */
    private Boolean aiGenerated;

    /** 活动信息来源 URL（BWIKI 链接，溯源）。 */
    private String sourceUrl;

    private Integer viewCount;

    @TableLogic
    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
