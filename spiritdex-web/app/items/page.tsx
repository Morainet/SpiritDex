import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchItems } from "@/lib/api";
import { pick } from "@/lib/utils";
import ItemCard from "@/components/ItemCard";
import ItemFilters from "@/components/ItemFilters";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = {
  title: "道具图鉴",
  description: "洛克王国手游全部道具，按主分类/稀有度筛选",
};

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const mainCategory = pick(sp.mainCategory);
  const rarity = pick(sp.rarity);
  const q = pick(sp.q);
  const page = Math.max(1, parseInt(pick(sp.page) ?? "1", 10) || 1);

  let result: Awaited<ReturnType<typeof fetchItems>> = { list: [], total: 0, page, size: 24 };
  try {
    result = await fetchItems({ mainCategory, rarity, q, page, size: 24 });
  } catch {
    // 后端不可用，降级渲染
  }

  const passThrough: Record<string, string | undefined> = { mainCategory, rarity, q };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">道具图鉴</h1>
        <p className="text-sm text-muted">共 {result.total} 个道具</p>
      </header>

      <Suspense fallback={<div className="mb-6 h-16" />}>
        <ItemFilters />
      </Suspense>

      {result.list.length === 0 ? (
        <div className="py-16 text-center text-muted">没有匹配的道具</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {result.list.map((it) => (
            <ItemCard key={it.slug} item={it} />
          ))}
        </div>
      )}

      <Pagination page={page} size={result.size} total={result.total} basePath="/items" searchParams={passThrough} unit="个" />
    </main>
  );
}
