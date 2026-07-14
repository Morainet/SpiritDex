import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, ExternalLink } from "lucide-react";
import { fetchQuestDetail } from "@/lib/api";

/** 任务分类配色（与 QuestCard 一致）。 */
const CATEGORY_STYLE: Record<string, string> = {
  旅途: "bg-blue-500",
  奇谭: "bg-violet-500",
  拾遗: "bg-emerald-500",
};

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const quest = await fetchQuestDetail(slug);
  if (!quest) return { title: "任务不存在" };
  return { title: `任务·${quest.name}`, description: quest.description?.slice(0, 80) };
}

export default async function QuestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quest = await fetchQuestDetail(slug);
  if (!quest) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/quests" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回任务图鉴
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold">{quest.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {quest.category && (
            <span className={`rounded-md px-2 py-0.5 text-sm font-medium text-white ${CATEGORY_STYLE[quest.category] ?? "bg-secondary"}`}>
              {quest.category}
            </span>
          )}
          {quest.seq && <span className="font-mono text-sm text-muted">{quest.seq}</span>}
          {quest.location && (
            <span className="inline-flex items-center gap-0.5 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5" /> {quest.location}
            </span>
          )}
        </div>
      </header>

      {quest.description && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">任务简介</h2>
          <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{quest.description}</p>
        </section>
      )}

      {quest.reward && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">任务奖励</h2>
          <p className="text-sm leading-relaxed text-muted">{quest.reward}</p>
        </section>
      )}

      {quest.note && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">备注</h2>
          <p className="text-sm leading-relaxed text-muted">{quest.note}</p>
        </section>
      )}

      {quest.attribution && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">归属</h2>
          <p className="text-sm text-muted">{quest.attribution}</p>
        </section>
      )}

      {quest.sourceUrl && (
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          数据来源：
          <a href={quest.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
            BWIKI <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </main>
  );
}
