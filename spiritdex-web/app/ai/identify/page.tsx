import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { fetchAiStatus } from "@/lib/ai-chat";
import IdentifyClient from "@/components/IdentifyClient";
import AiHero from "@/components/AiHero";

export const metadata: Metadata = {
  title: "AI 图片识别",
  description: "上传精灵截图，AI 识别候选精灵",
};

export const dynamic = "force-dynamic";

export default async function IdentifyPage() {
  let enabled = false;
  try {
    enabled = await fetchAiStatus();
  } catch {
    enabled = false;
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <AiHero
        variant="ice"
        icon={<Camera className="h-5 w-5" />}
        title="AI 图片识别"
        subtitle="上传精灵截图，AI 视觉模型识别并匹配候选精灵"
      />
      <IdentifyClient enabled={enabled} />
    </main>
  );
}
