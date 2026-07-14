/** 印记列表项（卡片精简版）。 */
export interface MarkListItem {
  slug: string;
  name: string;
  /** 正面 / 负面 */
  faction?: string;
  effectText?: string;
}

/** 可施加技能条目。 */
export interface MarkSourceSkill {
  name: string;
  desc?: string;
}

/** 印记详情（全字段）。 */
export interface MarkDetail extends MarkListItem {
  catalogId?: string;
  mechanics?: string;
  sourceSkills?: MarkSourceSkill[];
  sourceUrl?: string;
}
