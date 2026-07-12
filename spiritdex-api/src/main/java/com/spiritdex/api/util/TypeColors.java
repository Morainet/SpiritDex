package com.spiritdex.api.util;

import java.util.Map;

/**
 * 18 属性 → 配色（hex）。前后端语义一致（前端 lib/type-colors.ts 同步）。
 * 用于属性徽章、相克矩阵染色。
 */
public final class TypeColors {

    private static final Map<String, String> BY_SLUG = Map.ofEntries(
            Map.entry("normal", "#9099A0"),
            Map.entry("grass", "#5DBE62"),
            Map.entry("fire", "#F0832E"),
            Map.entry("water", "#3B95F2"),
            Map.entry("light", "#F2C94C"),
            Map.entry("ground", "#B5793C"),
            Map.entry("ice", "#7FD4E8"),
            Map.entry("dragon", "#8A6FE8"),
            Map.entry("electric", "#F2C94C"),
            Map.entry("poison", "#9B59B6"),
            Map.entry("bug", "#A8B820"),
            Map.entry("fighting", "#C0392B"),
            Map.entry("flying", "#8AA9D6"),
            Map.entry("cute", "#EC6FA8"),
            Map.entry("ghost", "#6C5B7B"),
            Map.entry("dark", "#4A4A4A"),
            Map.entry("machine", "#95A5A6"),
            Map.entry("illusion", "#B370E8")
    );

    private TypeColors() {
    }

    /** 取属性配色，未知返回中性灰。 */
    public static String of(String slug) {
        return BY_SLUG.getOrDefault(slug, "#9099A0");
    }
}
