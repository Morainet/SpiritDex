package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 道具图鉴实体。来自 BWIKI Category:道具 页面级 {@code {{物品信息}}} 模板（约 1780 条）。
 * 纯展示实体，无关联表。字段映射见 scraper/src/item_fetcher.py。
 */
@Data
@TableName("item")
public class Item {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 稳定 slug：item-0001（按抓取顺序）。 */
    private String slug;
    /** BWIKI 页面名（稳定唯一，seed upsert 判定键）。 */
    private String catalogId;
    private String name;
    /** 紫 / 蓝 / 橙 / 绿。 */
    private String rarity;
    /** 主分类：材料 / 技能石 / 重要 / 精灵蛋 / 精灵果实 / 任务 / 家具 / 咕噜球。 */
    private String mainCategory;
    private String subCategory;
    private String usageText;
    private String description;
    private String sourceText;
    private String iconId;
    private String dataVersion;
    private String sourceUrl;

    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
