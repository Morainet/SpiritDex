import type { Metadata } from "next";
import { fetchPetStats, fetchTypeMatrix } from "@/lib/api";
import type { PetListItem, PetStats } from "@/types/pet";
import type { TypeMatrix } from "@/types/spiritdex";
import DamageCalculator from "@/components/DamageCalculator";

export const metadata: Metadata = {
  title: "伤害计算器",
  description: "计算精灵对战伤害，含属性相克倍率",
};

export const dynamic = "force-dynamic";

export default async function DamageCalculatorPage() {
  // 容错：后端不可用时降级
  let statsList: PetStats[] = [];
  let matrix: Awaited<ReturnType<typeof fetchTypeMatrix>> | null = null;
  try {
    [statsList, matrix] = await Promise.all([
      fetchPetStats(),
      fetchTypeMatrix(),
    ]);
  } catch {
    // 后端不可用，降级渲染
  }
  // 一次请求替代逐个查详情（消除 N+1）
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
        <h1 className="text-2xl font-bold">伤害计算器</h1>
        <p className="text-sm text-muted">
          选择攻击方与防御方精灵，计算技能伤害与属性相克倍率（基础公式，不含特性/天气等高级机制）
        </p>
      </header>
      {pets.length === 0 || !matrix ? (
        <p className="py-8 text-center text-muted">无法加载数据，请确认后端服务已启动。</p>
      ) : (
        <DamageCalculator pets={pets} detailMap={detailMap} matrix={matrix} />
      )}
    </main>
  );
}
