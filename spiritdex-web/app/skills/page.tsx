import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchSkills, fetchTypes } from "@/lib/api";
import SkillCard from "@/components/SkillCard";
import SkillFilters from "@/components/SkillFilters";
import Pagination from "@/components/Pagination";

export const metadata: Metadata = {
  title: "技能库",
  description: "洛克王国手游全部技能，按属性/类别筛选",
};

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

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

  const [types, result] = await Promise.all([
    fetchTypes(),
    fetchSkills({ element, category, q, page, size: 24 }),
  ]);

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
        <div className="py-16 text-center text-muted">没有匹配的技能</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {result.list.map((s) => (
            <SkillCard key={s.slug} skill={s} />
          ))}
        </div>
      )}

      <Pagination page={page} size={result.size} total={result.total} basePath="/skills" searchParams={passThrough} />
    </main>
  );
}
