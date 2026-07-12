import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchArticleDetail, fetchArticles } from "@/lib/api";

export const dynamicParams = false;

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
      </header>

      <article className="prose-spiritdex">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => href?.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        }}>
          {article.content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
