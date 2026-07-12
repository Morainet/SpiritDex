import Link from "next/link";
import {
  BookOpen,
  Calculator,
  Camera,
  Database,
  Ghost,
  Settings2,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from "lucide-react";

const ENTRIES = [
  { href: "/pets", icon: Database, title: "精灵图鉴", desc: "671 只精灵全收录，种族值、进化链、技能一览", color: "var(--type-grass)" },
  { href: "/skills", icon: Zap, title: "技能库", desc: "全部技能效果、属性、威力参数", color: "var(--type-electric)" },
  { href: "/types/matrix", icon: Shield, title: "属性相克", desc: "18 属性相克矩阵，点击查看克制关系", color: "var(--type-water)" },
  { href: "/tools/damage-calculator", icon: Calculator, title: "伤害计算器", desc: "计算对战伤害，含属性相克倍率", color: "var(--type-fire)" },
  { href: "/tools/team-builder", icon: Swords, title: "阵容模拟", desc: "组建队伍，分析属性覆盖与弱点", color: "var(--type-fighting)" },
  { href: "/ai/chat", icon: Ghost, title: "AI 智能问答", desc: "基于精灵数据的 RAG 问答助手，流式回答", color: "var(--type-dragon)" },
  { href: "/ai/recommend", icon: Settings2, title: "AI 阵容推荐", desc: "输入已有精灵，AI 推荐最佳阵容", color: "var(--type-illusion)" },
  { href: "/ai/identify", icon: Camera, title: "AI 图片识别", desc: "上传精灵截图，AI 识别候选精灵", color: "var(--type-cute)" },
  { href: "/articles", icon: BookOpen, title: "攻略文章", desc: "新手指南、进阶技巧、活动攻略", color: "var(--accent)" },
];

export default function Home() {
  return (
    <main>
      {/* 英雄区 */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface to-background">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            洛克王国手游攻略站
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            灵宠档案
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            数据驱动的精灵图鉴、属性工具与 AI 智能助手
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/pets"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.97]"
            >
              <Database className="mr-2 h-5 w-5" />
              浏览图鉴
            </Link>
            <Link
              href="/ai/chat"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-surface px-8 font-medium transition-all hover:bg-surface-2 active:scale-[0.97]"
            >
              <Ghost className="mr-2 h-5 w-5" />
              AI 问答
            </Link>
          </div>
        </div>
      </section>

      {/* 功能入口 */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENTRIES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
            >
              {/* 顶部色条 */}
              <div className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ backgroundColor: e.color }} />
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ backgroundColor: e.color }}
              >
                <e.icon className="h-6 w-6" />
              </div>
              <h2 className="flex items-center gap-1 text-lg font-bold transition-colors group-hover:text-primary">
                {e.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{e.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
