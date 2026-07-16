/**
 * 站点导航配置（site-header 与首页共用，单一数据源，消除漂移）。
 *
 * icon 是 lucide-react 图标组件（type 为 LucideIcon）。
 * header 用 href/label/icon；首页额外用 desc/color。
 */
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calculator,
  Camera,
  Database,
  FlaskConical,
  Gauge,
  Ghost,
  Map as MapIcon,
  MapPin,
  Package,
  ScrollText,
  Settings2,
  Shield,
  Stamp,
  Swords,
  Zap,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  /** 导航栏显示名。 */
  label: string;
  /** 首页卡片标题（默认与 label 相同）。 */
  title?: string;
  /** 首页卡片描述。 */
  desc: string;
  /** 首页卡片配色（CSS 变量）。 */
  color: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "图鉴",
    items: [
      { href: "/pets", icon: Database, label: "精灵图鉴", desc: "671 只精灵全收录", color: "var(--type-grass)" },
      { href: "/skills", icon: Zap, label: "技能库", desc: "737 个技能参数", color: "var(--type-electric)" },
      { href: "/items", icon: Package, label: "道具图鉴", desc: "1779 个道具", color: "var(--type-poison)" },
      { href: "/quests", icon: ScrollText, label: "任务图鉴", desc: "剧情任务一览", color: "var(--type-water)" },
      { href: "/marks", icon: Stamp, label: "印记图鉴", desc: "战斗印记系统", color: "var(--type-dark)" },
      { href: "/types/matrix", icon: Shield, label: "属性相克", desc: "18 属性相克矩阵", color: "var(--type-fire)" },
      { href: "/map", icon: MapIcon, label: "地图", desc: "点位分布与精灵出没地区", color: "var(--type-ground)" },
      { href: "/locations", icon: MapPin, label: "分布地区", desc: "按地区查询精灵", color: "var(--type-flying)" },
    ],
  },
  {
    label: "知识",
    items: [
      { href: "/articles?category=机制", icon: FlaskConical, label: "机制知识库", desc: "相克/性格/培养/捕捉", color: "var(--type-dragon)" },
      { href: "/articles", icon: BookOpen, label: "攻略文章", desc: "新手指南与活动攻略", color: "var(--accent)" },
    ],
  },
  {
    label: "工具",
    items: [
      { href: "/tools/damage-calculator", icon: Calculator, label: "伤害计算器", desc: "对战伤害计算", color: "var(--type-fighting)" },
      { href: "/tools/nature-calculator", icon: Gauge, label: "性格计算器", desc: "性格六维增减计算", color: "var(--type-poison)" },
      { href: "/tools/team-builder", icon: Swords, label: "阵容模拟", desc: "组建队伍分析弱点", color: "var(--type-ground)" },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/ai/chat", icon: Ghost, label: "智能问答", desc: "RAG 流式问答助手", color: "var(--type-illusion)" },
      { href: "/ai/recommend", icon: Settings2, label: "阵容推荐", desc: "AI 推荐最佳阵容", color: "var(--type-cute)" },
      { href: "/ai/identify", icon: Camera, label: "图片识别", desc: "截图识别精灵", color: "var(--type-ice)" },
    ],
  },
];
