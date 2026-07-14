/** 任务列表项（卡片精简版）。 */
export interface QuestListItem {
  slug: string;
  name: string;
  /** 旅途 / 奇谭 / 拾遗 */
  category?: string;
  /** 任务序号，如 "1_1"。 */
  seq?: string;
  location?: string;
  imageKey?: string;
}

/** 任务详情（全字段，纯展示无关联）。 */
export interface QuestDetail extends QuestListItem {
  catalogId?: string;
  description?: string;
  reward?: string;
  note?: string;
  attribution?: string;
  sourceUrl?: string;
}
