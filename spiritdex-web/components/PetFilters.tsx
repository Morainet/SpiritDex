"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { SpiritType } from "@/types/spiritdex";
import { typeColor } from "@/lib/type-colors";
import { Input } from "@/components/ui/input";

const STAGES = [
  { value: "", label: "全部" },
  { value: "1", label: "一阶" },
  { value: "2", label: "二阶" },
  { value: "3", label: "三阶" },
];

/** 筛选器：改 URL query 驱动。 */
export default function PetFilters({ types }: { types: SpiritType[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const currentType = params.get("type") ?? "";
  const currentStage = params.get("stage") ?? "";

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if ("type" in next || "stage" in next || "q" in next) sp.delete("page");
    startTransition(() => router.push(`/pets?${sp.toString()}`));
  }

  return (
    <div className={`mb-6 space-y-3 ${isPending ? "opacity-60" : ""}`}>
      {/* 属性 chip */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted">属性</span>
        <button
          onClick={() => push({ type: "" })}
          className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${
            currentType === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"
          }`}
        >
          全部
        </button>
        {types.map((t) => (
          <button
            key={t.slug}
            onClick={() => push({ type: t.slug === currentType ? "" : t.slug })}
            className="rounded-lg px-2.5 py-1 text-sm font-medium text-white transition-transform hover:scale-105"
            style={{
              backgroundColor: typeColor(t.name),
              outline: t.slug === currentType ? "2px solid var(--foreground)" : "none",
              outlineOffset: 1,
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* 阶段 */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted">阶段</span>
          {STAGES.map((s) => (
            <button
              key={s.value}
              onClick={() => push({ stage: s.value })}
              className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${
                currentStage === s.value ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 搜索 */}
        <form
          className="relative flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: query.trim() });
          }}
        >
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索精灵名"
            className="w-44 pl-9"
          />
          {(params.get("q") || params.get("type") || params.get("stage")) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                push({ q: "", type: "", stage: "" });
              }}
              className="ml-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
              title="清除筛选"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
