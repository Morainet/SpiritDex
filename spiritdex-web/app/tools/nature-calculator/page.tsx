import type { Metadata } from "next";
import Link from "next/link";
import { fetchPetStats } from "@/lib/api";
import type { PetListItem, PetStats } from "@/types/pet";
import NatureCalculator from "@/components/NatureCalculator";

export const metadata: Metadata = {
  title: "性格计算器",
  description: "选择精灵与性格，实时计算六维面板增减，附智能推荐",
};

export const dynamic = "force-dynamic";

export default async function NatureCalculatorPage() {
  const statsList = await fetchPetStats().catch(() => [] as PetStats[]);
  const detailMap: Record<string, PetStats> = {};
  const pets: PetListItem[] = [];
  statsList.forEach((s) => {
    detailMap[s.slug] = s;
    pets.push({
      slug: s.slug, dexNo: s.dexNo, name: s.name,
      stage: s.stage, types: s.types, headKey: s.headKey,
    });
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">性格计算器</h1>
        <p className="text-sm text-muted">
          选择精灵与性格，实时查看六维种族值的增减效果。性格会让一项能力 +10%、另一项 -10%。
          想了解性格系统原理，请阅读{" "}
          <Link href="/articles/mechanism-nature" className="underline hover:text-foreground">
            性格系统详解
          </Link>
          。
        </p>
      </header>
      {pets.length === 0 ? (
        <p className="py-8 text-center text-muted">无法加载精灵数据，请确认后端服务已启动。</p>
      ) : (
        <NatureCalculator pets={pets} detailMap={detailMap} />
      )}
    </main>
  );
}
