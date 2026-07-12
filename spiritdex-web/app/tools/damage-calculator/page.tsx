import type { Metadata } from "next";
import { fetchPets, fetchPetDetail, fetchTypeMatrix } from "@/lib/api";
import type { PetDetail, PetListItem } from "@/types/pet";
import type { TypeMatrix } from "@/types/spiritdex";
import DamageCalculator from "@/components/DamageCalculator";

export const metadata: Metadata = {
  title: "伤害计算器",
  description: "计算精灵对战伤害，含属性相克倍率",
};

// 关闭静态生成（这是交互工具，不需要预渲染）
export const dynamic = "force-dynamic";

export default async function DamageCalculatorPage() {
  const [petList, matrix] = await Promise.all([
    fetchPets({ size: 1000 }),
    fetchTypeMatrix(),
  ]);
  // 预取详情（种族值），供客户端查表
  const details = await Promise.all(
    petList.list.map((p) => fetchPetDetail(p.slug).catch(() => null))
  );
  const detailMap: Record<string, PetDetail> = {};
  details.forEach((d) => {
    if (d) detailMap[d.slug] = d;
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">伤害计算器</h1>
        <p className="text-sm text-muted">
          选择攻击方与防御方精灵，计算技能伤害与属性相克倍率（基础公式，不含特性/天气等高级机制）
        </p>
      </header>
      <DamageCalculator pets={petList.list} detailMap={detailMap} matrix={matrix} />
    </main>
  );
}
