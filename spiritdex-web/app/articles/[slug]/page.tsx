import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchArticleDetail, fetchArticles } from "@/lib/api";

// 允许按需生成未预渲染的 slug（AI 定时发布的新文章即时可访问），
// 配合 revalidate 每小时 ISR，新发布文章 1 小时内自动可见。
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const result = await fetchArticles(undefined, 1, 1000);
  return result.list.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticleDetail(slug);
  if (!article) return { title: "文章不存在" };
  return { title: article.title, description: article.summary };
}

function fmtDate(s?: string): string {
  if (!s) return "";
  return new Date(s).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await fetchArticleDetail(slug);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/articles" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回攻略列表
      </Link>

      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>
        {article.summary && <p className="mt-2 text-sm text-muted">{article.summary}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{article.authorName ?? "灵宠档案编辑部"}</span>
          {article.createdAt && <span>· {fmtDate(article.createdAt)}</span>}
          {article.viewCount != null && <span>· {article.viewCount} 阅读</span>}
          {article.tags?.map((t) => (
            <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted">{t}</span>
          ))}
        </div>
        {article.aiGenerated && (
          <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted">
            本文由 AI 基于活动信息自动生成，具体奖励与数值请以游戏内为准。
            {article.sourceUrl && <> 数据来源：<a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">BWIKI</a></>}
          </p>
        )}
      </header>

      <article className="prose-spiritdex">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => {
            if (!href) return <a>{children}</a>;
            // 站内精灵/技能链接：渲染成更友好的跳转入口
            if (href.startsWith("/")) {
              // 链接文本是裸路径（如 /pets/pet-0001）时，显示成「查看详情→」
              const text = typeof children === "string" && children === href
                ? "查看详情 →" : children;
              const isPet = href.startsWith("/pets/");
              return (
                <Link href={href} className={isPet ? "font-medium text-accent hover:underline" : undefined}>
                  {text}
                </Link>
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
        }}>
          {article.content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
