/** 道具列表项（卡片精简版）。 */
export interface ItemListItem {
  slug: string;
  name: string;
  /** 紫 / 蓝 / 橙 / 绿 */
  rarity?: string;
  /** 材料 / 技能石 / 重要 / 精灵蛋 / 精灵果实 / 任务 / 家具 / 咕噜球 */
  mainCategory?: string;
  subCategory?: string;
  iconId?: string;
}

/** 道具详情（全字段，纯展示无关联）。 */
export interface ItemDetail extends ItemListItem {
  catalogId?: string;
  usageText?: string;
  description?: string;
  sourceText?: string;
  dataVersion?: string;
  sourceUrl?: string;
}
