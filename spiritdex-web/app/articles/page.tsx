import type { Metadata } from "next";
import Link from "next/link";
import { fetchArticles } from "@/lib/api";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = {
  title: "攻略文章",
  description: "洛克王国手游攻略、新手指南、进阶技巧",
};

const CATEGORY_BADGE: Record<string, string> = {
  新手: "bg-[var(--type-grass)]",
  进阶: "bg-secondary",
  活动: "bg-accent",
  机制: "bg-[var(--type-dragon)]",
};

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function fmtDate(s?: string): string {
  if (!s) return "";
  return new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const category = pick(sp.category);
  const page = Math.max(1, parseInt(pick(sp.page) ?? "1", 10) || 1);
  const result = await fetchArticles(category, page, 12);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">攻略文章</h1>
        <p className="text-sm text-muted">共 {result.total} 篇文章</p>
      </header>

      <div className="mb-6 flex items-center gap-1.5 text-sm">
        <span className="mr-1 text-muted">分类</span>
        {["", "新手", "进阶", "活动", "机制"].map((c) => (
          <Link key={c || "all"} href={c ? `/articles?category=${c}` : "/articles"} className={`rounded-lg px-2.5 py-0.5 transition-colors ${(category ?? "") === c ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}>
            {c || "全部"}
          </Link>
        ))}
      </div>

      {result.list.length === 0 ? (
        <div className="py-16 text-center text-muted">暂无文章</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {result.list.map((a) => (
            <Link key={a.slug} href={`/articles/${a.slug}`} className="flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                {a.category && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white ${CATEGORY_BADGE[a.category] ?? "bg-surface-2 text-muted"}`}>{a.category}</span>}
                {a.aiGenerated && (
                  <span className="rounded-md bg-[var(--type-dragon)] px-1.5 py-0.5 text-[11px] font-medium text-white" title="本文由 AI 生成，数据请以游戏内为准">AI</span>
                )}
                {a.createdAt && <span className="text-xs text-muted-foreground">{fmtDate(a.createdAt)}</span>}
              </div>
              <h2 className="mt-2 text-lg font-semibold leading-snug">{a.title}</h2>
              {a.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.summary}</p>}
              <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted-foreground">
                <span>{a.authorName ?? "灵宠档案编辑部"}</span>
                {a.tags && a.tags.length > 0 && <span>· {a.tags.join(" / ")}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} size={result.size} total={result.total} basePath="/articles" searchParams={{ category }} />
    </main>
  );
}
