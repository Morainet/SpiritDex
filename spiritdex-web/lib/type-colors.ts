/**
 * 中文属性名 → 配色（与后端 TypeColors.java 语义一致）。
 * 用于无后端 type.color 时的兜底染色（卡片徽章 / 矩阵单元格）。
 */
const COLORS: Record<string, string> = {
  普通: "#9099A0",
  草: "#5DBE62",
  火: "#F0832E",
  水: "#3B95F2",
  光: "#F2C94C",
  地: "#B5793C",
  冰: "#7FD4E8",
  龙: "#8A6FE8",
  电: "#F2C94C",
  毒: "#9B59B6",
  虫: "#A8B820",
  武: "#C0392B",
  翼: "#8AA9D6",
  萌: "#EC6FA8",
  幽: "#6C5B7B",
  恶: "#4A4A4A",
  机械: "#95A5A6",
  幻: "#B370E8",
};

export function typeColor(name?: string | null): string {
  if (!name) return "#9099A0";
  return COLORS[name] ?? "#9099A0";
}

export function typeColorStyle(name?: string | null): React.CSSProperties {
  return { backgroundColor: typeColor(name), color: "#fff" };
}
