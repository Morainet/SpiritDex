"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Camera, Swords, Send, Square, Ghost, RotateCcw, Copy, Check, Plus, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamChat, type ChatRefs, type ChatHistoryMsg } from "@/lib/ai-chat";

interface Message {
  role: "user" | "assistant";
  content: string;
  refs?: ChatRefs[];
  error?: boolean;
}

const QUICK_QUESTIONS = ["火系被什么克制？", "新手选哪只初始精灵好？", "迪莫是什么精灵？"];
const MAX_HISTORY = 8; // 最近 4 轮 = 8 条消息
// 顶栏 h-16 = 4rem；本组件占满剩余视口（dvh 应对移动端地址栏动态高度，vh 兜底）
const VIEWPORT_MINUS_HEADER = "h-[calc(100vh-4rem)] supports-[height:100dvh]:h-[calc(100dvh-4rem)]";

export default function ChatClient({
  enabled,
  presetQuestion,
}: {
  enabled: boolean;
  presetQuestion?: string;
}) {
  const [input, setInput] = useState(presetQuestion ?? "");
  // 会话 id + 消息都持久化到 localStorage：后退/刷新后恢复对话视图
  // 后端靠前端传的 history 维持上下文；sid 换新即开新会话。
  const sidRef = useRef<string>("anon");
  const mkRef = useRef<string>("spiritdex-chat-msgs-anon");
  // 用 sessionEpoch 触发 sid/mk 重建（新对话时 +1）
  const [sessionEpoch, setSessionEpoch] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sk = "spiritdex-chat-session";
    let id = localStorage.getItem(sk);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(sk, id);
    }
    sidRef.current = id;
    mkRef.current = `spiritdex-chat-msgs-${id}`;
  }, [sessionEpoch]);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      // 初始挂载时读，sessionEpoch 变化由 newChat 单独清空
      const sk = "spiritdex-chat-session";
      let id = localStorage.getItem(sk);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(sk, id);
      }
      const raw = localStorage.getItem(`spiritdex-chat-msgs-${id}`);
      return raw ? (JSON.parse(raw) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // textarea 自动增高：按内容撑高，上限 9rem（约 6 行）后内部滚动；发送后回缩
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 144) + "px";
  }, [input]);

  // 消息变化时写回 localStorage（防抖 200ms：流式高频更新合并，避免写爆）
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(mkRef.current, JSON.stringify(messages));
      } catch {
        // 容量超限或无痕模式，静默放弃
      }
    }, 200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [messages]);

  useEffect(() => {
    if (presetQuestion) ask(presetQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 修复跳动：流式输出时用 auto（smooth 在高频更新时抖动），且只在新消息时滚动。
  // 从 localStorage 恢复时，首次直接跳到底部（无 smooth）。
  const lastMsgCount = useRef(0);
  const didInitScroll = useRef(false);
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!didInitScroll.current) {
      didInitScroll.current = true;
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      lastMsgCount.current = messages.length;
      return;
    }
    const smooth = messages.length !== lastMsgCount.current;
    lastMsgCount.current = messages.length;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, [messages]);

  // 滚动监听：离底部远时显示「回到底部」按钮
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpBottom(distFromBottom > 200);
  }, []);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");

    // 构造多轮历史（最近 MAX_HISTORY 条，不含本次）
    const history: ChatHistoryMsg[] = messages
      .filter((m) => !m.error && m.content)
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;

    await streamChat(
      q,
      (token) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + token };
          return copy;
        });
      },
      (refs) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], refs };
          return copy;
        });
      },
      (err) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: err, error: true };
          return copy;
        });
      },
      ac.signal,
      history,
      sidRef.current
    );
    setLoading(false);
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  /** 新对话：生成新 sid，清空消息 + 旧 localStorage 桶 */
  function newChat() {
    if (loading) abortRef.current?.abort();
    const newId = typeof crypto !== "undefined" ? crypto.randomUUID() : `s-${Date.now()}`;
    if (typeof window !== "undefined") {
      localStorage.setItem("spiritdex-chat-session", newId);
      // 清旧桶（保留历史会话的数据以防万一，但当前视图清空）
    }
    sidRef.current = newId;
    mkRef.current = `spiritdex-chat-msgs-${newId}`;
    setMessages([]);
    setLoading(false);
    setSessionEpoch((e) => e + 1);
    setInput("");
  }

  /** 重试：移除最后那条错误的 AI 消息，用上一条用户问题重发 */
  function retry() {
    if (loading) return;
    // 从当前 messages 取最后一条 user 问题，截断到它之前，再重发
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const q = messages[lastUserIdx].content;
    setMessages((ms) => ms.slice(0, lastUserIdx));
    void ask(q);
  }

  const turns = Math.floor(messages.filter((m) => !m.error && m.content).length / 2);

  return (
    <main className={`${VIEWPORT_MINUS_HEADER} flex flex-col bg-background`}>
      {/* 极简会话顶栏（替代旧 AiHero） */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--type-illusion)] text-white">
            <Ghost className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">灵宠档案 AI</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? (
                <>
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                  在线 · 基于全站精灵数据
                </>
              ) : (
                "未启用"
              )}
            </p>
          </div>
          {turns > 0 && (
            <span className="hidden rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted sm:inline">
              已记 {turns} 轮
            </span>
          )}
          <button
            onClick={newChat}
            disabled={messages.length === 0 && !loading}
            title="开始新对话"
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs text-muted transition-colors hover:border-[var(--type-illusion)] hover:text-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">新对话</span>
          </button>
        </div>
      </div>

      {/* 消息列表（居中窄列，flex-1 占满） */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={scrollRef} onScroll={handleScroll} className="ai-msg-list h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
            {messages.length === 0 && (
              <EmptyState enabled={enabled} loading={loading} onPick={(q) => ask(q)} />
            )}
            {messages.map((m, i) => (
              <MessageRow
                key={i}
                m={m}
                loading={loading}
                isLast={i === messages.length - 1}
                onRetry={retry}
              />
            ))}
          </div>
        </div>
        {/* 回到底部悬浮按钮（滚离底部 200px 时出现） */}
        {showJumpBottom && (
          <button
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
            className="absolute bottom-4 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-[var(--shadow-hover)] transition-colors hover:text-foreground"
            aria-label="回到底部"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 吸底输入区（居中窄列） */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-3xl">
          {!enabled && (
            <p className="mb-2 text-center text-xs text-muted-foreground">
              AI 问答暂未启用（未配置 GLM API key），配置后即可使用
            </p>
          )}
          <form
            className="flex items-end gap-2 rounded-2xl border border-input bg-surface p-2 shadow-[var(--shadow-card)] focus-within:border-[var(--type-illusion)] focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--type-illusion)_20%,transparent)]"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder={enabled ? "给灵宠 AI 发消息…  (Enter 发送 / Shift+Enter 换行)" : "AI 未启用"}
              rows={1}
              disabled={!enabled || loading}
              className="max-h-36 min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            {loading ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-surface-2 px-3 text-sm text-muted transition-colors hover:text-foreground"
              >
                <Square className="h-3.5 w-3.5 fill-current" /> 停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!enabled || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--type-illusion)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                aria-label="发送"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/ai/identify" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
              <Camera className="h-3.5 w-3.5" /> 识别精灵
            </Link>
            <Link href="/ai/recommend" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
              <Swords className="h-3.5 w-3.5" /> 阵容推荐
            </Link>
            <span className="hidden sm:inline">AI 回答基于已收录数据，仅供参考</span>
          </div>
        </div>
      </div>
    </main>
  );
}

/** 空状态：居中大头像 + 提示 + 快捷问题 */
function EmptyState({
  enabled,
  loading,
  onPick,
}: {
  enabled: boolean;
  loading: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <span
        className="ai-avatar ai-avatar-ai mb-4"
        style={{ width: "3.5rem", height: "3.5rem", fontSize: "1.75rem" }}
      >
        🤖
      </span>
      <h2 className="mb-1 text-lg font-semibold">有什么可以帮你？</h2>
      <p className="mb-6 text-sm text-muted-foreground">向 AI 助手提问精灵、属性、技能、相克关系，支持多轮对话记忆</p>
      <div className="grid w-full max-w-md gap-2 sm:grid-cols-3">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            disabled={!enabled || loading}
            className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-muted transition-all hover:-translate-y-0.5 hover:border-[var(--type-illusion)] hover:text-foreground hover:shadow-[var(--shadow-card)] disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 单条消息：IM 式一问一答。用户靠右（primary 红气泡），AI 靠左（illusion 染色气泡） */
function MessageRow({
  m,
  loading,
  isLast,
  onRetry,
}: {
  m: Message;
  loading: boolean;
  isLast: boolean;
  onRetry: () => void;
}) {
  const isUser = m.role === "user";
  const showCursor = !isUser && !m.error && loading && isLast && m.content.length > 0;
  const [copied, setCopied] = useState(false);
  const isStreaming = !isUser && !m.error && loading && isLast; // 正在生成的 AI 消息

  function copy() {
    navigator.clipboard?.writeText(m.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={`group flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <span
        className={`ai-avatar mt-0.5 ${isUser ? "ai-avatar-user" : "ai-avatar-ai"}`}
        aria-hidden
      >
        {isUser ? "🧑" : "🤖"}
      </span>
      <div className={`flex max-w-[80%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-3.5 py-2 text-sm leading-relaxed ${
            isUser
              ? "rounded-2xl rounded-tr-sm bg-[var(--primary)] text-[var(--primary-foreground)]"
              : m.error
              ? "rounded-2xl rounded-tl-sm bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]"
              : "rounded-2xl rounded-tl-sm border bg-[color-mix(in_srgb,var(--type-illusion)_7%,var(--surface-2))] border-[color-mix(in_srgb,var(--type-illusion)_22%,var(--border))]"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{m.content}</p>
          ) : m.error ? (
            <p className="whitespace-pre-wrap">{m.content}</p>
          ) : (
            <div className={`prose-chat ${showCursor ? "ai-cursor" : ""}`}>
              {m.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              ) : loading && isLast ? (
                <span className="ai-typing" aria-label="AI 正在思考">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
            </div>
          )}
          {m.refs && m.refs.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
              <span className="text-xs text-muted-foreground">来源：</span>
              {m.refs.map((r) => (
                <Link
                  key={r.slug}
                  href={`/pets/${r.slug}`}
                  className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs text-secondary transition-colors hover:border-secondary hover:underline"
                >
                  {r.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        {/* 气泡下方操作行：AI 完成/错误后显示，hover 才显现（移动端常驻） */}
        {!isUser && !isStreaming && (
          <div className="mt-1 flex items-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
            {m.error ? (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> 重试
              </button>
            ) : m.content ? (
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "已复制" : "复制"}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
