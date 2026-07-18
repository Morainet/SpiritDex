import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { fetchPets } from "@/lib/api";
import { fetchAiStatus } from "@/lib/ai-chat";
import RecommendClient from "@/components/RecommendClient";
import AiHero from "@/components/AiHero";

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
      <AiHero
        variant="cute"
        icon={<Settings2 className="h-5 w-5" />}
        title="AI 阵容推荐"
        subtitle="选择你拥有的精灵和目标场景，AI 推荐最佳阵容与培养顺序"
      />
      <RecommendClient pets={petList.list} enabled={enabled} />
    </main>
  );
}
