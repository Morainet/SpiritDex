import type { Metadata } from "next";
import { fetchAiStatus } from "@/lib/ai-chat";
import IdentifyClient from "@/components/IdentifyClient";

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
      <header className="mb-4">
        <h1 className="text-2xl font-bold">🔍 AI 图片识别</h1>
        <p className="text-sm text-muted">上传精灵截图，AI 识别并匹配候选精灵（返回多个候选供你选择）</p>
      </header>
      <IdentifyClient enabled={enabled} />
    </main>
  );
}
