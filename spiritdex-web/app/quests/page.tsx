import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchQuests } from "@/lib/api";
import { pick } from "@/lib/utils";
import QuestCard from "@/components/QuestCard";
import QuestFilters from "@/components/QuestFilters";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = {
  title: "任务图鉴",
  description: "洛克王国手游剧情任务，按分类筛选",
};

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const category = pick(sp.category);
  const q = pick(sp.q);
  const page = Math.max(1, parseInt(pick(sp.page) ?? "1", 10) || 1);

  let result: Awaited<ReturnType<typeof fetchQuests>> = { list: [], total: 0, page, size: 24 };
  try {
    result = await fetchQuests({ category, q, page, size: 24 });
  } catch {
    // 后端不可用，降级渲染
  }
  const passThrough: Record<string, string | undefined> = { category, q };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">任务图鉴</h1>
        <p className="text-sm text-muted">共 {result.total} 个任务</p>
      </header>

      <Suspense fallback={<div className="mb-6 h-16" />}>
        <QuestFilters />
      </Suspense>

      {result.list.length === 0 ? (
        <div className="py-16 text-center text-muted">没有匹配的任务</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {result.list.map((q) => (
            <QuestCard key={q.slug} quest={q} />
          ))}
        </div>
      )}

      <Pagination page={page} size={result.size} total={result.total} basePath="/quests" searchParams={passThrough} unit="个" />
    </main>
  );
}
