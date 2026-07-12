import type { NextRequest } from "next/server";

/**
 * AI 聊天 SSE 转发代理。
 *
 * 不走 next.config.ts 的 rewrites（rewrite 代理会缓冲整个 SSE 响应），
 * 而是用 Route Handler 直连后端，立即返回 ReadableStream，保证浏览器逐 token 流式。
 *
 * 部署时：生产环境前端在 Vercel，后端在国内云，BACKEND_URL 指向后端地址。
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND_URL =
  process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch(`${BACKEND_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body,
  });

  // 立即返回上游的流（不等待完成）—— 这是避免缓冲的关键
  if (!upstream.body) {
    return new Response("upstream 无响应体", { status: 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 防反代缓冲（Nginx 等）
      "X-Accel-Buffering": "no",
    },
  });
}
