import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchMarks } from "@/lib/api";
import { pick } from "@/lib/utils";
import MarkCard from "@/components/MarkCard";
import MarkFilters from "@/components/MarkFilters";
import Pagination from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "印记图鉴",
  description: "洛克王国手游战斗印记系统，正面/负面印记效果与机制",
};

export default async function MarksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const faction = pick(sp.faction);
  const q = pick(sp.q);
  const page = Math.max(1, parseInt(pick(sp.page) ?? "1", 10) || 1);

  let result: Awaited<ReturnType<typeof fetchMarks>> = { list: [], total: 0, page, size: 24 };
  try {
    result = await fetchMarks({ faction, q, page, size: 24 });
  } catch {
    // 后端不可用，降级渲染
  }
  const passThrough: Record<string, string | undefined> = { faction, q };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">印记图鉴</h1>
        <p className="text-sm text-muted">共 {result.total} 个印记</p>
      </header>

      <Suspense fallback={<div className="mb-6 h-16" />}>
        <MarkFilters />
      </Suspense>

      {result.list.length === 0 ? (
        <EmptyState action={{ href: "/marks", label: "清除筛选" }} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {result.list.map((m) => (
            <MarkCard key={m.slug} mark={m} />
          ))}
        </div>
      )}

      <Pagination page={page} size={result.size} total={result.total} basePath="/marks" searchParams={passThrough} unit="个" />
    </main>
  );
}
