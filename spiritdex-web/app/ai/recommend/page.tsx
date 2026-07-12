import type { Metadata } from "next";
import { fetchPets } from "@/lib/api";
import { fetchAiStatus } from "@/lib/ai-chat";
import RecommendClient from "@/components/RecommendClient";

export const metadata: Metadata = {
  title: "AI 阵容推荐",
  description: "输入你拥有的精灵，AI 推荐最佳阵容与培养优先级",
};

export const dynamic = "force-dynamic";

export default async function RecommendPage() {
  let enabled = false;
  try {
    enabled = await fetchAiStatus();
  } catch {
    enabled = false;
  }
  const petList = await fetchPets({ size: 1000 });
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">🛡️ AI 阵容推荐</h1>
        <p className="text-sm text-muted">选择你拥有的精灵和目标场景，AI 推荐最佳阵容与培养顺序</p>
      </header>
      <RecommendClient pets={petList.list} enabled={enabled} />
    </main>
  );
}
