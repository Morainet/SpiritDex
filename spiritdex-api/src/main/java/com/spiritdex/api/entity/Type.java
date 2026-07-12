package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 属性（type）—— 18 个枚举：普通/草/火/水/...
 */
@Data
@TableName("type")
public class Type {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 拼音 slug，如 grass / fire / water。 */
    private String slug;

    /** 中文名，如「草」。 */
    private String name;

    private String nameEn;

    private Integer sortOrder;

    private String color;

    private String icon;

    private String sourceUrl;

    @TableLogic
    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
