"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import type { SpiritType } from "@/types/spiritdex";
import { typeColor } from "@/lib/type-colors";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["特性", "攻击", "变化", "防御"];

export default function SkillFilters({ types }: { types: SpiritType[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const currentElement = params.get("element") ?? "";
  const currentCategory = params.get("category") ?? "";

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if ("element" in next || "category" in next || "q" in next) sp.delete("page");
    startTransition(() => router.push(`/skills?${sp.toString()}`));
  }

  return (
    <div className={`mb-6 space-y-3 ${isPending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted">属性</span>
        <button onClick={() => push({ element: "" })} className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentElement === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}>全部</button>
        {types.map((t) => (
          <button key={t.slug} onClick={() => push({ element: t.name === currentElement ? "" : t.name })} className="rounded-lg px-2.5 py-1 text-sm font-medium text-white transition-transform hover:scale-105" style={{ backgroundColor: typeColor(t.name), outline: t.name === currentElement ? "2px solid var(--foreground)" : "none", outlineOffset: 1 }}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted">类别</span>
          <button onClick={() => push({ category: "" })} className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentCategory === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}>全部</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => push({ category: c === currentCategory ? "" : c })} className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentCategory === c ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}>{c}</button>
          ))}
        </div>
        <form className="relative flex items-center" onSubmit={(e) => { e.preventDefault(); push({ q: query.trim() }); }}>
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索技能名" className="w-40 pl-9" />
        </form>
      </div>
    </div>
  );
}
