import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { searchAll, type SearchResult } from "@/lib/api";
import { pick } from "@/lib/utils";
import { SearchBox } from "./search-box";
import { ResultGroups } from "./result-groups";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "搜索",
  description: "全站搜索精灵、技能、道具、印记、任务",
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = pick(sp.q)?.trim() ?? "";

  // 有查询词时并行搜索 5 个板块（容错）
  let result: SearchResult | null = null;
  if (q) {
    try {
      result = await searchAll(q, 8);
    } catch {
      // 后端不可用降级
    }
  }

  const totalHits = result
    ? result.totals.pets + result.totals.skills + result.totals.items + result.totals.quests + result.totals.marks
    : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回首页
      </Link>

      <header className="mb-6">
        <h1 className="mb-3 flex items-center gap-2 text-2xl font-bold">
          <SearchIcon className="h-6 w-6" /> 全站搜索
        </h1>
        <SearchBox initialQuery={q} />
      </header>

      {!q ? (
        <EmptyState icon={SearchIcon} title="开始搜索" description="输入关键词搜索精灵、技能、道具、印记、任务" />
      ) : !result || totalHits === 0 ? (
        <EmptyState title={`没有找到与「${q}」相关的内容`} description="换个关键词试试,或检查拼写" />
      ) : (
        <ResultGroups q={q} result={result} />
      )}
    </main>
  );
}
