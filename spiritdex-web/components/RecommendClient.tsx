"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PetListItem } from "@/types/pet";
import { streamRecommend } from "@/lib/ai-chat";
import { petHeadUrl } from "@/lib/image";
import { typeColor } from "@/lib/type-colors";

const GOALS = ["综合对战", "推图", "PVP", "副本", "BOSS"];

export default function RecommendClient({
  pets,
  enabled,
}: {
  pets: PetListItem[];
  enabled: boolean;
}) {
  const [owned, setOwned] = useState<string[]>([]);
  const [goal, setGoal] = useState("综合对战");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  function toggle(slug: string) {
    setOwned((o) => (o.includes(slug) ? o.filter((s) => s !== slug) : [...o, slug]));
  }

  async function submit() {
    if (owned.length < 3) {
      setError("请至少选择 3 只精灵");
      return;
    }
    setError("");
    setAnswer("");
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;
    await streamRecommend(
      owned,
      goal,
      (token) => setAnswer((a) => a + token),
      (err) => setError(err),
      ac.signal
    );
    setLoading(false);
  }

  const filtered = q.trim() ? pets.filter((p) => p.name.includes(q.trim())).slice(0, 30) : pets.slice(0, 30);

  return (
    <div className="space-y-4">
      {!enabled && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-muted">
          AI 推荐暂未启用（未配置 GLM API key）。
        </div>
      )}

      {/* 目标场景 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">目标场景</span>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`rounded px-2 py-0.5 text-sm transition-colors ${
                goal === g ? "bg-foreground text-white" : "bg-surface-2 text-muted hover:bg-surface-2"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* 已选精灵 */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">已选精灵（{owned.length}）</span>
          {owned.length > 0 && (
            <button onClick={() => setOwned([])} className="text-xs text-muted-foreground hover:text-muted">
              清空
            </button>
          )}
        </div>
        {owned.length === 0 ? (
          <p className="text-sm text-muted-foreground">从下方搜索选择你拥有的精灵</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {owned.map((s) => {
              const p = pets.find((x) => x.slug === s);
              if (!p) return null;
              return (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  className="flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-sm hover:bg-surface-2"
                >
                  {p.name} ✕
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 搜索选择 */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索精灵添加"
        className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((p) => {
          const sel = owned.includes(p.slug);
          return (
            <button
              key={p.slug}
              onClick={() => toggle(p.slug)}
              className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors ${
                sel ? "border-primary bg-surface-2" : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              {(() => {
                const url = petHeadUrl(p.headKey);
                return url ? (
                  <Image src={url} alt={p.name} width={24} height={24} unoptimized className="object-contain" />
                ) : (
                  <span>🐾</span>
                );
              })()}
              <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
              {p.types?.[0] && (
                <span className="rounded px-1 text-[9px] text-white" style={{ backgroundColor: typeColor(p.types[0]) }}>
                  {p.types[0]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 提交 */}
      <button
        onClick={submit}
        disabled={!enabled || loading || owned.length < 3}
        className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "AI 思考中…" : "生成推荐"}
      </button>

      {error && <div className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] p-3 text-sm text-[var(--danger)]">{error}</div>}

      {/* 推荐（流式 markdown） */}
      {(answer || loading) && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-muted">AI 推荐</h2>
          {answer ? (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">生成中…</p>
          )}
        </div>
      )}
    </div>
  );
}
