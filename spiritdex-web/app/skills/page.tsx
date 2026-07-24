import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchSkills, fetchTypes } from "@/lib/api";
import { pick } from "@/lib/utils";
import SkillCard from "@/components/SkillCard";
import SkillFilters from "@/components/SkillFilters";
import Pagination from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "技能库",
  description: "洛克王国手游全部技能，按属性/类别筛选",
};

export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const element = pick(sp.element);
  const category = pick(sp.category);
  const q = pick(sp.q);
  const page = Math.max(1, parseInt(pick(sp.page) ?? "1", 10) || 1);

  let types: Awaited<ReturnType<typeof fetchTypes>> = [];
  let result: Awaited<ReturnType<typeof fetchSkills>> = { list: [], total: 0, page, size: 24 };
  try {
    [types, result] = await Promise.all([
      fetchTypes(),
      fetchSkills({ element, category, q, page, size: 24 }),
    ]);
  } catch {
    // 后端不可用，降级渲染
  }

  const passThrough: Record<string, string | undefined> = { element, category, q };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">技能库</h1>
        <p className="text-sm text-muted">共 {result.total} 个技能</p>
      </header>

      <Suspense fallback={<div className="mb-6 h-16" />}>
        <SkillFilters types={types} />
      </Suspense>

      {result.list.length === 0 ? (
        <EmptyState action={{ href: "/skills", label: "清除筛选" }} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {result.list.map((s) => (
            <SkillCard key={s.slug} skill={s} />
          ))}
        </div>
      )}

      <Pagination page={page} size={result.size} total={result.total} basePath="/skills" searchParams={passThrough} unit="个" />
    </main>
  );
}
