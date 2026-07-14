package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 任务图鉴实体。来自 BWIKI Category:任务 页面级 {@code {{任务信息}}} 模板（约 18 条）。
 * 纯展示实体，无关联表。字段映射见 scraper/src/quest_fetcher.py。
 */
@Data
@TableName("quest")
public class Quest {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String slug;
    /** 任务名称（稳定唯一，seed upsert 判定键）。 */
    private String catalogId;
    private String name;
    /** 任务序号，如 "1_1"。 */
    private String seq;
    /** 旅途 / 奇谭 / 拾遗。 */
    private String category;
    private String location;
    private String description;
    private String reward;
    private String imageKey;
    private String note;
    private String attribution;
    private String sourceUrl;

    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
