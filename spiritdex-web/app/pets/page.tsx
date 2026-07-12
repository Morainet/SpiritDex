import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchPets, fetchTypes } from "@/lib/api";
import PetCard from "@/components/PetCard";
import PetFilters from "@/components/PetFilters";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = {
  title: "精灵图鉴",
  description: "洛克王国手游全部精灵图鉴，按属性/阶段筛选",
};

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const type = pick(sp.type);
  const stageStr = pick(sp.stage);
  const q = pick(sp.q);
  const page = Math.max(1, parseInt(pick(sp.page) ?? "1", 10) || 1);

  const [types, result] = await Promise.all([
    fetchTypes(),
    fetchPets({ type, stage: stageStr ? parseInt(stageStr, 10) : undefined, q, page, size: 24 }),
  ]);

  const passThrough: Record<string, string | undefined> = { type, stage: stageStr, q };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">精灵图鉴</h1>
        <p className="text-sm text-muted">共 {result.total} 只精灵</p>
      </header>

      <Suspense fallback={<div className="mb-6 h-16" />}>
        <PetFilters types={types} />
      </Suspense>

      {result.list.length === 0 ? (
        <div className="py-16 text-center text-muted">没有匹配的精灵</div>
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
        searchParams={passThrough}
      />
    </main>
  );
}
