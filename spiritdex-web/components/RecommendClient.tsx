"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Settings2, Sparkles } from "lucide-react";
import type { PetListItem } from "@/types/pet";
import { petHeadUrl } from "@/lib/image";
import { typeColor } from "@/lib/type-colors";
import { recommendCards, type RecommendCard } from "@/lib/ai-chat";
import { fetchMyFavorites } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import ProxyImage from "@/components/ProxyImage";

const GOALS = ["综合对战", "推图", "PVP", "副本", "BOSS"];
const ROLE_COLOR: Record<string, string> = {
  主力: "var(--type-fire)",
  辅助: "var(--type-grass)",
  对策: "var(--type-water)",
};

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendCard[] | null>(null);
  const [error, setError] = useState("");
  const [favLoaded, setFavLoaded] = useState(false); // 收藏是否已加载

  // 已登录时自动加载收藏作为「我的精灵」（一次性）
  useEffect(() => {
    if (!isLoggedIn()) return;
    fetchMyFavorites(1, 200)
      .then((res) => {
        if (res.list.length > 0) {
          setOwned(res.list.map((p) => p.slug));
        }
      })
      .catch(() => {})
      .finally(() => setFavLoaded(true));
  }, []);

  const ownedSet = useMemo(() => new Set(owned), [owned]);
  const filtered = useMemo(() => {
    const k = q.trim();
    const arr = k ? pets.filter((p) => p.name.includes(k)) : pets;
    return arr.slice(0, 30);
  }, [pets, q]);

  function toggle(slug: string) {
    setOwned((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
    setResult(null);
    setError("");
  }

  async function submit() {
    if (owned.length < 3 || loading) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const cards = await recommendCards(owned, goal);
      setResult(cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "推荐失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {!enabled && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-muted">
          AI 推荐暂未启用（未配置 GLM API key）。
        </div>
      )}

      {/* 目标场景 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">目标场景</span>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                goal === g
                  ? "bg-[var(--type-cute)] text-white"
                  : "bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* 已选精灵 */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">已选精灵（{owned.length}）</span>
          <div className="flex items-center gap-3">
            {isLoggedIn() && (
              <button
                onClick={() => {
                  setFavLoaded(false);
                  fetchMyFavorites(1, 200)
                    .then((res) => setOwned(res.list.map((p) => p.slug)))
                    .catch(() => {})
                    .finally(() => setFavLoaded(true));
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-muted"
                title="从我的收藏加载"
              >
                <Heart className="h-3 w-3" />
                {favLoaded ? "重新加载收藏" : "加载收藏…"}
              </button>
            )}
            {owned.length > 0 && (
              <button onClick={() => setOwned([])} className="text-xs text-muted-foreground hover:text-muted">
                清空
              </button>
            )}
          </div>
        </div>
        {owned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isLoggedIn()
              ? "收藏的精灵会自动加载，或从下方搜索添加（至少 3 只）"
              : "从下方搜索选择你拥有的精灵（至少 3 只），登录后可自动加载收藏"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {owned.map((s) => {
              const p = pets.find((x) => x.slug === s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pl-2 pr-1.5 text-sm transition-colors hover:bg-surface"
                >
                  {p?.types?.[0] && (
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeColor(p.types[0]) }} />
                  )}
                  {p?.name ?? s}
                  <span className="text-muted-foreground">✕</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 搜索 + 可选网格 */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索精灵添加…"
        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--type-cute)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--type-cute)_20%,transparent)]"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((p) => {
          const sel = ownedSet.has(p.slug);
          return (
            <button
              key={p.slug}
              onClick={() => toggle(p.slug)}
              className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors ${
                sel ? "border-[var(--type-cute)] bg-surface-2" : "border-border bg-surface hover:bg-surface-2"
              }`}
            >
              <ProxyImage
                src={petHeadUrl(p.headKey)}
                alt={p.name}
                width={24}
                height={24}
                className="object-contain"
                fallback={<span>🐾</span>}
              />
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

      {/* 提交按钮 */}
      <button
        onClick={submit}
        disabled={!enabled || loading || owned.length < 3}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--type-cute)] to-[var(--type-illusion)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Settings2 className="h-4 w-4" />
        {loading ? "AI 推荐中…" : `生成阵容推荐（${owned.length}/3+）`}
      </button>

      {/* 错误 */}
      {error && (
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* 结果：骨架屏 或 结构化卡片 */}
      {loading && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
            <Sparkles className="h-4 w-4" /> AI 正在分析阵容…
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="ai-skeleton mb-2 h-4 w-20" />
                <div className="ai-skeleton mb-1.5 h-3 w-full" />
                <div className="ai-skeleton h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {result && result.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[var(--type-cute)]" />
            AI 推荐阵容（{result.length} 只）
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.map((c, i) => {
              const p = pets.find((x) => x.slug === c.slug || x.name === c.name);
              const primaryColor = p?.types?.[0] ? typeColor(p.types[0]) : "var(--muted)";
              return (
                <Link
                  key={i}
                  href={p ? `/pets/${p.slug}` : "#"}
                  className="group overflow-hidden rounded-xl border border-border transition-all hover:shadow-[var(--shadow-card)]"
                >
                  <div className="h-1" style={{ backgroundColor: primaryColor }} />
                  <div className="flex items-start gap-2.5 p-3">
                    {p && (
                      <div className="relative h-12 w-12 shrink-0">
                        <ProxyImage
                          src={petHeadUrl(p.headKey)}
                          alt={c.name}
                          fill
                          className="object-contain"
                          fallback={<span className="flex h-full w-full items-center justify-center text-xl opacity-30">🐾</span>}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{c.name}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: ROLE_COLOR[c.role] ?? "var(--muted)" }}
                        >
                          {c.role}
                        </span>
                      </div>
                      {p?.types && p.types.length > 0 && (
                        <div className="mt-0.5 flex gap-1">
                          {p.types.map((t) => (
                            <span key={t} className="rounded px-1 text-[10px] text-white" style={{ backgroundColor: typeColor(t) }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-xs leading-relaxed text-muted">{c.reason}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
