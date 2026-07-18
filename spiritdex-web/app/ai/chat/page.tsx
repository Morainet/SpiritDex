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

  // ChatGPT 式全屏对话页：占满除顶栏外的视口，无 max-w 容器、无 AiHero
  return (
    <ChatClient enabled={enabled} presetQuestion={presetQ} />
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
