import type { Metadata } from "next";
import ChatClient from "@/components/ChatClient";

export const metadata: Metadata = {
  title: "AI 智能问答",
  description: "向灵宠档案 AI 助手提问，关于洛克王国手游精灵、属性、技能",
};

export const dynamic = "force-dynamic";

export default function AiChatPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <ChatPage searchParams={searchParams} />;
}

async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const presetQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const enabled = await fetchEnabled();
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">🤖 AI 智能问答</h1>
        <p className="text-sm text-muted">基于全站精灵数据的 RAG 问答助手，流式回答</p>
      </header>
      <ChatClient enabled={enabled} presetQuestion={presetQ} />
    </main>
  );
}

async function fetchEnabled(): Promise<boolean> {
  const { fetchAiStatus } = await import("@/lib/ai-chat");
  try {
    return await fetchAiStatus();
  } catch {
    return false;
  }
}
