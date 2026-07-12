export interface SpiritType {
  slug: string;
  name: string;
  nameEn?: string;
  sortOrder?: number;
  /** 配色 hex（与后端 TypeColors 一致）。 */
  color?: string;
}

/** 属性相克矩阵。 */
export interface TypeMatrix {
  types: SpiritType[];
  /** key = "{attackingSlug}->{defendingSlug}"，仅含非 1.0；取不到视为 1.0。 */
  multipliers: Record<string, number>;
}
