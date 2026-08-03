import type { Metadata } from "next";
import { fetchPets, fetchTypeMatrix } from "@/lib/api";
import TeamBuilder from "@/components/TeamBuilder";

export const metadata: Metadata = {
  title: "阵容模拟",
  description: "组建精灵阵容，分析属性覆盖与弱点",
};

export const dynamic = "force-dynamic";

export default async function TeamBuilderPage() {
  // 容错：后端不可用时降级，与伤害计算器页一致
  let petList: Awaited<ReturnType<typeof fetchPets>> | null = null;
  let matrix: Awaited<ReturnType<typeof fetchTypeMatrix>> | null = null;
  try {
    [petList, matrix] = await Promise.all([
      fetchPets({ size: 1000 }),
      fetchTypeMatrix(),
    ]);
  } catch {
    // 后端不可用，降级渲染
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">阵容模拟</h1>
        <p className="text-sm text-muted">
          选择最多 6 只精灵组建队伍，分析属性覆盖、共同弱点与团队优势
        </p>
      </header>
      {!petList || !matrix || petList.list.length === 0 ? (
        <p className="py-8 text-center text-muted">无法加载数据，请确认后端服务已启动。</p>
      ) : (
        <TeamBuilder pets={petList.list} matrix={matrix} />
      )}
    </main>
  );
}
