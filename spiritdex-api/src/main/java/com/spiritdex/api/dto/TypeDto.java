package com.spiritdex.api.dto;

import lombok.Data;

/**
 * 属性（type）对外结构。
 */
@Data
public class TypeDto {
    private String slug;
    private String name;
    private String nameEn;
    private Integer sortOrder;
    /** 前端配色（hex 或 Tailwind 友好的色值），由 TypeService 注入。 */
    private String color;
}
