package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 精灵 ↔ 属性（多对多关联）。slot=1 主属性，slot=2 副属性。
 */
@Data
@TableName("pet_type")
public class PetType {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long petId;

    private Long typeId;

    /** 主属性=1，副属性=2。 */
    private Integer slot;

    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
