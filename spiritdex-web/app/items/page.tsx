import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchItems } from "@/lib/api";
import ItemCard from "@/components/ItemCard";
import ItemFilters from "@/components/ItemFilters";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = {
  title: "道具图鉴",
  description: "洛克王国手游全部道具，按主分类/稀有度筛选",
};

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

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

  const result = await fetchItems({ mainCategory, rarity, q, page, size: 24 });

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

      <Pagination page={page} size={result.size} total={result.total} basePath="/items" searchParams={passThrough} />
    </main>
  );
}
