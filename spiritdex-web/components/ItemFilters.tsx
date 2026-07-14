"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** 主分类枚举（BWIKI 实测 8 类）。 */
const MAIN_CATEGORIES = ["材料", "技能石", "重要", "精灵蛋", "精灵果实", "任务", "家具", "咕噜球"];
/** 稀有度枚举（4 级）。 */
const RARITIES = ["紫", "蓝", "橙", "绿"];

export default function ItemFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const currentCategory = params.get("mainCategory") ?? "";
  const currentRarity = params.get("rarity") ?? "";

  function push(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if ("mainCategory" in next || "rarity" in next || "q" in next) sp.delete("page");
    startTransition(() => router.push(`/items?${sp.toString()}`));
  }

  return (
    <div className={`mb-6 space-y-3 ${isPending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted">主分类</span>
        <button
          onClick={() => push({ mainCategory: "" })}
          className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentCategory === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
        >
          全部
        </button>
        {MAIN_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => push({ mainCategory: c === currentCategory ? "" : c })}
            className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentCategory === c ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted">稀有度</span>
          <button
            onClick={() => push({ rarity: "" })}
            className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentRarity === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
          >
            全部
          </button>
          {RARITIES.map((r) => (
            <button
              key={r}
              onClick={() => push({ rarity: r === currentRarity ? "" : r })}
              className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${currentRarity === r ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
            >
              {r}
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
            placeholder="搜索道具名"
            className="w-40 pl-9"
          />
        </form>
      </div>
    </div>
  );
}
