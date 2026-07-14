"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** 阵营枚举。 */
const FACTIONS = ["正面", "负面"];

export default function MarkFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const currentFaction = params.get("faction") ?? "";

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if ("faction" in next || "q" in next) sp.delete("page");
    startTransition(() => router.push(`/marks?${sp.toString()}`));
  }

  return (
    <div className={`mb-6 space-y-3 ${isPending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted">阵营</span>
          <button
            onClick={() => push({ faction: "" })}
            className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentFaction === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            全部
          </button>
          {FACTIONS.map((f) => (
            <button
              key={f}
              onClick={() => push({ faction: f === currentFaction ? "" : f })}
              className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentFaction === f ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
            >
              {f}
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
            placeholder="搜索印记名"
            className="w-40 pl-9"
          />
        </form>
      </div>
    </div>
  );
}
