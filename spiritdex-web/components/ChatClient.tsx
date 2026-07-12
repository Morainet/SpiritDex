"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamChat, type ChatRefs } from "@/lib/ai-chat";

interface Message {
  role: "user" | "assistant";
  content: string;
  refs?: ChatRefs[];
  error?: boolean;
}

const QUICK_QUESTIONS = ["火系被什么克制？", "新手选哪只初始精灵好？", "迪莫是什么精灵？"];

export default function ChatClient({
  enabled,
  presetQuestion,
}: {
  enabled: boolean;
  presetQuestion?: string;
}) {
  const [input, setInput] = useState(presetQuestion ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (presetQuestion) ask(presetQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
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
      ac.signal
    );
    setLoading(false);
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
      {!enabled && (
        <div className="border-b border-border bg-surface-2 px-4 py-2 text-sm text-muted">
          AI 问答暂未启用（未配置 GLM API key）。配置后即可使用。
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <p className="mb-3">向 AI 助手提问，它会基于精灵图鉴数据作答</p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={!enabled || loading}
                  className="rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-muted hover:text-foreground disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : m.error
                  ? "bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]"
                  : "bg-surface-2 text-foreground"
              }`}
            >
              {m.role === "assistant" && !m.error ? (
                <div className="prose-chat">
                  {m.content || (loading && i === messages.length - 1 ? "思考中…" : "") ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : null}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content || (loading && i === messages.length - 1 ? "思考中…" : "")}</p>
              )}
              {m.refs && m.refs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
                  <span className="text-xs text-muted">来源：</span>
                  {m.refs.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/pets/${r.slug}`}
                      className="rounded bg-surface px-1.5 py-0.5 text-xs text-secondary hover:underline"
                    >
                      {r.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="border-t border-border p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的问题…"
            disabled={!enabled || loading}
            className="flex-1 rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          {loading ? (
            <button type="button" onClick={stop} className="rounded-lg bg-surface-2 px-4 py-2 text-sm text-muted">
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!enabled}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              发送
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
