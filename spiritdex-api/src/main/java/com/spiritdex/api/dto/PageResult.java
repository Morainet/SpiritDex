package com.spiritdex.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 统一分页响应（约定见 doc/implementation-plan.md §六）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult<T> {
    private List<T> list;
    private long total;
    private int page;
    private int size;

    public static <T> PageResult<T> of(List<T> list, long total, int page, int size) {
        return new PageResult<>(list, total, page, size);
    }

    /** 分页参数规范化：page ≥ 1，size 在 [1, maxSize] 之间。防止恶意大 size 拖垮查询。 */
    public static int normalizePage(int page) {
        return Math.max(1, page);
    }

    public static int normalizeSize(int size, int maxSize) {
        if (size < 1) return 24;
        return Math.min(size, maxSize);
    }
}
