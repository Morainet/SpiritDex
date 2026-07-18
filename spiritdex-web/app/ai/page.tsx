import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Ghost, Settings2, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "灵宠 AI 助手",
  description: "智能问答、阵容推荐、图片识别 —— 基于全站精灵数据的 AI 能力",
};

const CAPABILITIES = [
  {
    href: "/ai/chat",
    icon: Ghost,
    title: "智能问答",
    desc: "向 AI 助手提问精灵、属性、技能、相克关系。基于全站 671 只精灵数据的 RAG 检索，流式回答并附来源引用。支持多轮对话记忆。",
    color: "var(--type-illusion)",
  },
  {
    href: "/ai/recommend",
    icon: Settings2,
    title: "阵容推荐",
    desc: "选择你拥有的精灵，AI 根据属性互补、种族值、相克关系推荐最佳阵容，给出每只精灵的定位与培养优先级。",
    color: "var(--type-cute)",
  },
  {
    href: "/ai/identify",
    icon: Camera,
    title: "图片识别",
    desc: "上传游戏截图，AI 视觉模型识别精灵外形，从图鉴库匹配候选并按相似度排序，秒级返回结果。",
    color: "var(--type-ice)",
  },
];

export default function AiHomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {/* 极简融合页眉：与主站列表页 header 同款，无渐变色块、无分割线 */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--type-illusion)] text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">灵宠 AI 助手</h1>
            <p className="text-xs text-muted sm:text-sm">基于全站精灵数据的智能问答、阵容推荐与图片识别</p>
          </div>
        </div>
      </header>

      {/* 三能力卡片 */}
      <div className="grid gap-4">
        {CAPABILITIES.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`group flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5`}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-110"
              style={{ backgroundColor: c.color }}
            >
              <c.icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{c.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{c.desc}</p>
            </div>
            <span className="self-center text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        AI 功能依赖智谱 GLM，未配置时自动降级。回答基于已收录数据，仅供参考。
      </p>
    </main>
  );
}
