package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 精灵 ↔ 分布地区（多对多关联）。来自页面级「分布地区」字段。
 * 与 {@link Pet#getHabitat()}（生态描述）不同，这是具体游戏地名。
 */
@Data
@TableName("pet_location")
public class PetLocation {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long petId;

    /** 游戏内地名（岚语峰/月牙镇/...）。 */
    private String location;

    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
