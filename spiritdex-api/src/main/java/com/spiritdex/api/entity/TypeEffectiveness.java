package com.spiritdex.api.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 属性相克矩阵：攻击方属性 × 防御方属性 → 倍率。
 * <p>仅存非 1（非正常）的条目；查询未命中即视为 1.0。
 */
@Data
@TableName("type_effectiveness")
public class TypeEffectiveness {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 攻击方属性 id（→ type.id）。 */
    private Long attackingTypeId;

    /** 防御方属性 id（→ type.id）。 */
    private Long defendingTypeId;

    /** 倍率：0=无效 / 0.5=减半 / 1=正常（通常不入库）/ 2=克制。 */
    private BigDecimal multiplier;

    private String sourceUrl;

    private Integer deleted;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
