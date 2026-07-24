import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchPets, fetchTypes } from "@/lib/api";
import { pick } from "@/lib/utils";
import PetCard from "@/components/PetCard";
import PetFilters from "@/components/PetFilters";
import Pagination from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "精灵图鉴",
  description: "洛克王国手游全部精灵图鉴，按属性/阶段筛选",
};

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const type = pick(sp.type);
  const stageStr = pick(sp.stage);
  const location = pick(sp.location);
  const q = pick(sp.q);
  const page = Math.max(1, parseInt(pick(sp.page) ?? "1", 10) || 1);

  // 容错：后端不可用时降级为空列表，不阻断页面渲染
  let types: Awaited<ReturnType<typeof fetchTypes>> = [];
  let result: Awaited<ReturnType<typeof fetchPets>> = { list: [], total: 0, page, size: 24 };
  try {
    [types, result] = await Promise.all([
      fetchTypes(),
      fetchPets({ type, stage: stageStr ? parseInt(stageStr, 10) : undefined, location, q, page, size: 24 }),
    ]);
  } catch {
    // 后端不可用，降级渲染
  }

  const passThrough: Record<string, string | undefined> = { type, stage: stageStr, location, q };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">精灵图鉴</h1>
        <p className="text-sm text-muted">
          共 {result.total} 只精灵
          {location && <> · 分布地区：<span className="font-medium text-foreground">{location}</span></>}
        </p>
      </header>

      <Suspense fallback={<div className="mb-6 h-16" />}>
        <PetFilters types={types} />
      </Suspense>

      {result.list.length === 0 ? (
        <EmptyState action={{ href: "/pets", label: "清除筛选" }} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {result.list.map((pet) => (
            <PetCard key={pet.slug} pet={pet} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        size={result.size}
        total={result.total}
        basePath="/pets"
        unit="只"
        searchParams={passThrough}
      />
    </main>
  );
}
