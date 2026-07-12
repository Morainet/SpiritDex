import type { Metadata } from "next";
import { fetchPets, fetchTypeMatrix } from "@/lib/api";
import type { PetListItem } from "@/types/pet";
import type { TypeMatrix } from "@/types/spiritdex";
import TeamBuilder from "@/components/TeamBuilder";

export const metadata: Metadata = {
  title: "阵容模拟",
  description: "组建精灵阵容，分析属性覆盖与弱点",
};

export const dynamic = "force-dynamic";

export default async function TeamBuilderPage() {
  const [petList, matrix] = await Promise.all([
    fetchPets({ size: 1000 }),
    fetchTypeMatrix(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">阵容模拟</h1>
        <p className="text-sm text-muted">
          选择最多 6 只精灵组建队伍，分析属性覆盖、共同弱点与团队优势
        </p>
      </header>
      <TeamBuilder pets={petList.list} matrix={matrix} />
    </main>
  );
}
