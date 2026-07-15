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
  /** 可学此技能的精灵（去重，最多 50 只）。 */
  pets?: { slug: string; name: string }[];
}
