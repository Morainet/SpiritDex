export interface SkillListItem {
  slug: string;
  name: string;
  category?: string;
  element?: string;
  power?: number | null;
  damageClass?: string;
  energy?: number | null;
  iconId?: string;
}

export interface SkillDetail {
  slug: string;
  catalogId?: string;
  name: string;
  category?: string;
  element?: string;
  power?: number | null;
  damageClass?: string;
  energy?: number | null;
  target?: string;
  effectText?: string;
  flavorText?: string;
  iconId?: string;
  /** 以此为特性技能的精灵（简略，完整技能池待后续抓取）。 */
  pets?: { slug: string; name: string }[];
}
