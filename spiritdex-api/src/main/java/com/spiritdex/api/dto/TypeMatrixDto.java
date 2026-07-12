package com.spiritdex.api.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 属性相克矩阵（前端可直接渲染 18×18 表格）。
 *
 * <p>查询 type_effectiveness 全量 + 18 type 组装；未命中的格子视为 1.0（正常）。
 * 数据为空时 types 仍有 18 项、multipliers 为空 map（前端渲染空白占位）。
 */
@Data
public class TypeMatrixDto {
    /** 行/列头，按 sortOrder 排序。 */
    private List<TypeDto> types;
    /**
     * 倍率表，key = "{attackingSlug}->{defendingSlug}"，value = 倍率。
     * 仅含非 1.0 的条目；前端取不到 key 即视为 1.0。
     */
    private Map<String, Double> multipliers;
}
