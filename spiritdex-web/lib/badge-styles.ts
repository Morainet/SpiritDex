/**
 * Badge 配色单一源。
 *
 * <p>统一管理印记阵营 / 任务分类 / 道具稀有度 / 技能类别的配色,
 * 消除原先散落在各 Card 与 [slug] 详情页里的硬编码 {@code bg-blue-500} 等
 * Tailwind 固定色——固定色在深色模式下饱和度不适配。
 *
 * <p>这里全部改用 CSS 变量({@code var(--secondary)} 等),浅/深两套主题
 * 在 globals.css 里分别定义,自动跟随,无需为每个 badge 写两套色。
 */

/** 返回 badge 的内联 style(backgroundColor 用 CSS 变量)。 */
export function badgeStyle(colorVar: string): { backgroundColor: string } {
  return { backgroundColor: colorVar };
}

/** 印记阵营色(正面=蓝/负面=红)。 */
export const MARK_FACTION_COLOR: Record<string, string> = {
  正面: "var(--secondary)",
  负面: "var(--danger)",
};

/** 任务分类色(旅途/奇谭/拾遗)。 */
export const QUEST_CATEGORY_COLOR: Record<string, string> = {
  旅途: "var(--secondary)",
  奇谭: "var(--type-dragon)",
  拾遗: "var(--success)",
};

/** 道具稀有度色(紫/蓝/橙/绿)。 */
export const ITEM_RARITY_COLOR: Record<string, string> = {
  紫: "var(--type-dragon)",
  蓝: "var(--secondary)",
  橙: "var(--accent)",
  绿: "var(--success)",
};

/** 技能类别色(特性/攻击/变化/防御)。 */
export const SKILL_CATEGORY_COLOR: Record<string, string> = {
  特性: "var(--type-poison)",
  攻击: "var(--type-fire)",
  变化: "var(--secondary)",
  防御: "var(--type-grass)",
};
