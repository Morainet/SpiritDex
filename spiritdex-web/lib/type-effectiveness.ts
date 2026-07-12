import type { SpiritType, TypeMatrix } from "@/types/spiritdex";

/** 取攻击方属性对防御方属性的倍率（未命中=1.0）。 */
export function multiplier(matrix: TypeMatrix, atkSlug: string, defSlug: string): number {
  return matrix.multipliers[`${atkSlug}->${defSlug}`] ?? 1;
}

export interface TypeAnalysis {
  /** 此属性（攻击时）克制的属性 slug。 */
  strongAgainst: string[];
  /** 此属性（攻击时）被减半的属性 slug。 */
  weakAgainst: string[];
  /** 克制此属性（防御时）的属性 slug —— 即别的属性打它 2x。 */
  counteredBy: string[];
  /** 打此属性减半的属性 slug —— 即别的属性打它 0.5x。 */
  resistedBy: string[];
}

/** 分析某属性的四向关系。 */
export function analyzeType(matrix: TypeMatrix, types: SpiritType[], slug: string): TypeAnalysis {
  const strongAgainst: string[] = [];
  const weakAgainst: string[] = [];
  const counteredBy: string[] = [];
  const resistedBy: string[] = [];
  for (const t of types) {
    const m = multiplier(matrix, slug, t.slug);
    if (m >= 2) strongAgainst.push(t.slug);
    else if (m < 1) weakAgainst.push(t.slug);

    const rev = multiplier(matrix, t.slug, slug);
    if (rev >= 2) counteredBy.push(t.slug);
    else if (rev < 1) resistedBy.push(t.slug);
  }
  return { strongAgainst, weakAgainst, counteredBy, resistedBy };
}

/**
 * 计算攻击属性对一组防御属性的合并倍率（双属性叠加）。
 * 例如草技能打 水系2x × 打冰系1x = 2x；打草0.5x × 打毒0.5x = 0.25x。
 */
export function combinedMultiplier(matrix: TypeMatrix, atkSlug: string, defSlugs: string[]): number {
  let m = 1;
  for (const d of defSlugs) m *= multiplier(matrix, atkSlug, d);
  return Math.round(m * 100) / 100; // 避免 0.25*2 的浮点尾
}
