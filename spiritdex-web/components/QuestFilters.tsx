"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** 任务分类枚举（旅途/奇谭/拾遗）。 */
const CATEGORIES = ["旅途", "奇谭", "拾遗"];

export default function QuestFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const currentCategory = params.get("category") ?? "";

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if ("category" in next || "q" in next) sp.delete("page");
    startTransition(() => router.push(`/quests?${sp.toString()}`));
  }

  return (
    <div className={`mb-6 space-y-3 ${isPending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted">分类</span>
          <button
            onClick={() => push({ category: "" })}
            className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentCategory === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            全部
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => push({ category: c === currentCategory ? "" : c })}
              className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentCategory === c ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <form
          className="relative flex items-center"
          onSubmit={(e) => { e.preventDefault(); push({ q: query.trim() }); }}
        >
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索任务名"
            className="w-40 pl-9"
          />
        </form>
      </div>
    </div>
  );
}
