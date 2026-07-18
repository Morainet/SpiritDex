/**
 * AI 聊天 SSE 客户端：用 fetch + ReadableStream 解析 SSE（支持 POST，方案 §二指定）。
 *
 * 后端 POST /api/ai/chat 返回 SSE，事件类型：
 * - event: delta   data: <token 增量>
 * - event: refs    data: <JSON 数组 [{slug,name}]>（回答来源）
 * - event: done    data: 1（结束）
 * - event: error   data: <错误信息>
 */

export interface ChatRefs {
  slug: string;
  name: string;
}

/** 单条历史消息（多轮对话用）。 */
export interface ChatHistoryMsg {
  role: "user" | "assistant";
  content: string;
}

export async function streamChat(
  question: string,
  onDelta: (token: string) => void,
  onRefs?: (refs: ChatRefs[]) => void,
  onError?: (msg: string) => void,
  signal?: AbortSignal,
  /** 多轮对话历史（最近 N 轮），后端 ChatMemory 用 */
  history?: ChatHistoryMsg[],
  /** 会话 id，后端区分不同对话的记忆 */
  sessionId?: string
): Promise<void> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history, sessionId }),
    signal,
  });

  if (!res.ok || !res.body) {
    onError?.(`请求失败 (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 以空行分隔事件
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      parseEvent(raw, onDelta, onRefs, onError);
    }
  }
}

function parseEvent(
  raw: string,
  onDelta: (t: string) => void,
  onRefs?: (r: ChatRefs[]) => void,
  onError?: (m: string) => void
) {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  switch (event) {
    case "delta":
      onDelta(data);
      break;
    case "refs":
      try {
        onRefs?.(JSON.parse(data));
      } catch {
        /* 忽略解析失败 */
      }
      break;
    case "error":
      onError?.(data);
      break;
    case "done":
    default:
      break;
  }
}

/** AI 是否启用（GET /api/ai/status）。服务端用 BACKEND_URL，客户端用相对路径。 */
export async function fetchAiStatus(): Promise<boolean> {
  const base = typeof window === "undefined" ? process.env.BACKEND_URL ?? "http://localhost:8080" : "";
  try {
    const res = await fetch(`${base}/api/ai/status`, { cache: "no-store" });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.enabled);
  } catch {
    return false;
  }
}

/**
 * 阵容推荐 SSE 流式（同 streamChat 解析逻辑，但走 /api/ai/recommend）。
 * 推荐也走 route handler 转发（app/api/ai/recommend/route.ts）避免缓冲。
 */
export async function streamRecommend(
  ownedPets: string[],
  goal: string,
  onDelta: (token: string) => void,
  onError?: (msg: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/ai/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownedPets, goal }),
    signal,
  });
  if (!res.ok || !res.body) {
    onError?.(`请求失败 (${res.status})`);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "delta") onDelta(data);
      else if (event === "error") onError?.(data);
    }
  }
}

/** 图片识别候选。 */
export interface IdentifyCandidate {
  slug: string;
  name: string;
  score: number;
  illustrationKey?: string;
}

export async function identifyImage(
  file: File,
  onResult: (desc: string, candidates: IdentifyCandidate[]) => void,
  onError?: (msg: string) => void
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch("/api/ai/identify", { method: "POST", body: form });
    const json = await res.json();
    if (json.code !== 0) {
      onError?.(json.message ?? "识别失败");
      return;
    }
    onResult(json.data.vlmDescription ?? "", json.data.candidates ?? []);
  } catch (e) {
    onError?.(e instanceof Error ? e.message : "网络错误");
  }
}

/**
 * 结构化阵容推荐（一次性 JSON，非流式）。
 * 后端返回 { code, data: [{slug, name, role, reason}] }。
 */
export interface RecommendCard {
  slug: string;
  name: string;
  role: string;
  reason: string;
}

export async function recommendCards(
  ownedPets: string[],
  goal: string
): Promise<RecommendCard[]> {
  const res = await fetch("/api/ai/recommend-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownedPets, goal }),
  });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message ?? "推荐失败");
  }
  return json.data ?? [];
}
