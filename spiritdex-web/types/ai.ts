/** AI 推荐结果（结构化卡片，来自后端 /api/ai/recommend-cards）。 */
export interface RecommendCard {
  slug: string;
  name: string;
  /** 角色定位：主力 / 辅助 / 对策。 */
  role: string;
  /** 推荐理由。 */
  reason: string;
}
