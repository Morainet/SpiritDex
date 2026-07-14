package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 印记图鉴实体（战斗印记系统）。来自 BWIKI「印记」总览页 + 独立页（约 13 条）。
 * source_skills 是 JSONB，用 JacksonTypeHandler 序列化（与 Pet.baseStats 同模式）。
 */
@Data
@TableName(value = "mark", autoResultMap = true)
public class Mark {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String slug;
    private String catalogId;
    private String name;
    /** 正面 / 负面。 */
    private String faction;
    private String effectText;
    private String mechanics;

    /** 可施加该印记的技能列表 [{name, desc}]。JSONB，用 JacksonTypeHandler。 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> sourceSkills;

    private String sourceUrl;

    @TableLogic
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
