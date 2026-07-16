import Link from "next/link";
import { ArrowRight, Database, Ghost, Sparkles } from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav-config";
import { fetchArticles, fetchPets } from "@/lib/api";
import type { ArticleListItem } from "@/types/article";
import type { PetListItem } from "@/types/pet";
import PetCard from "@/components/PetCard";

// 功能入口分组（与 site-header 导航对齐）
export default async function Home() {
  // 预取：御三家精灵（dexNo 1-3）+ 机制知识库文章
  // 容错：后端未启动时降级为只显示功能入口，不阻断首页渲染
  let starterPets: PetListItem[] = [];
  let mechArticles: { list: ArticleListItem[]; total: number } = { list: [], total: 0 };
  try {
    const [petsResult, articlesResult] = await Promise.all([
      fetchPets({ size: 3 }),
      fetchArticles("机制", 1, 4),
    ]);
    starterPets = petsResult.list.slice(0, 3);
    mechArticles = { list: articlesResult.list, total: articlesResult.total };
  } catch {
    // 后端不可用，降级渲染（功能入口区块不依赖数据）
  }

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

      {/* 功能入口（分组） */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="space-y-8">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((e) => (
                  <Link
                    key={e.href}
                    href={e.href}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ backgroundColor: e.color }} />
                    <div
                      className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: e.color }}
                    >
                      <e.icon className="h-6 w-6" />
                    </div>
                    <h3 className="flex items-center gap-1 text-lg font-bold transition-colors group-hover:text-primary">
                      {e.label}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{e.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 御三家 + 机制文章 */}
      <section className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* 御三家 */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">初始精灵</h2>
                <Link href="/pets" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
                  全部 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {starterPets.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {starterPets.map((p) => (
                    <PetCard key={p.slug} pet={p} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">暂无数据</p>
              )}
            </div>

            {/* 机制知识库文章 */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">机制知识库</h2>
                <Link href="/articles?category=机制" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
                  全部 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {mechArticles.list.length > 0 ? (
                <div className="space-y-2">
                  {mechArticles.list.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/articles/${a.slug}`}
                      className="block rounded-xl border border-border bg-surface p-3 transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[var(--type-dragon)] px-1.5 py-0.5 text-[11px] font-medium text-white">{a.category}</span>
                        <span className="font-semibold">{a.title}</span>
                      </div>
                      {a.summary && <p className="mt-1 line-clamp-1 text-sm text-muted">{a.summary}</p>}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">暂无文章</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
