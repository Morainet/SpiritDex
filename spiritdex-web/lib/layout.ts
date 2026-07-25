/**
 * 布局常量(容器宽度阶梯)。
 *
 * <p>收敛原先散落各页面的 7 国乱(max-w-2xl/3xl/4xl/5xl/6xl/7xl/md/xl)为 4 档规范,
 * 按页面类型选用。来自 UI 架构重设计方案 §4.1。
 */
export const WIDTH = {
  /** 列表页(图鉴/技能/道具/任务/印记):数据密集,多列网格 */
  list: "max-w-7xl",
  /** 详情页(精灵/文章):单列 + 侧栏 */
  detail: "max-w-5xl",
  /** 文章阅读 / AI 对话:聚焦阅读 */
  article: "max-w-3xl",
  /** 工具页(计算器/阵容):表单 + 结果 */
  tool: "max-w-4xl",
} as const;

export type WidthKey = keyof typeof WIDTH;
