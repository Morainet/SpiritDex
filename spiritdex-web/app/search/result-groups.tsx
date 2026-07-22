import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SearchResult } from "@/lib/api";
import type { PetListItem } from "@/types/pet";
import type { SkillListItem } from "@/types/skill";
import type { ItemListItem } from "@/types/item";
import type { QuestListItem } from "@/types/quest";
import type { MarkListItem } from "@/types/mark";

/** 搜索结果按板块分组展示。服务端组件（数据由页面传入）。 */
export function ResultGroups({ q, result }: { q: string; result: SearchResult }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        共找到 {result.totals.pets + result.totals.skills + result.totals.items + result.totals.quests + result.totals.marks} 条结果
      </p>

      <Group
        title="精灵"
        basePath="/pets"
        queryParam={`q=${encodeURIComponent(q)}`}
        total={result.totals.pets}
        items={result.pets.map((p) => ({
          href: `/pets/${p.slug}`,
          name: p.name,
          badges: p.types ?? [],
          sub: `No.${String(p.dexNo).padStart(4, "0")}`,
        }))}
      />

      <Group
        title="技能"
        basePath="/skills"
        queryParam={`q=${encodeURIComponent(q)}`}
        total={result.totals.skills}
        items={result.skills.map((s) => ({
          href: `/skills/${s.slug}`,
          name: s.name,
          badges: [s.category, s.element].filter(Boolean) as string[],
          sub: s.power != null ? `威力 ${s.power}` : undefined,
        }))}
      />

      <Group
        title="道具"
        basePath="/items"
        queryParam={`q=${encodeURIComponent(q)}`}
        total={result.totals.items}
        items={result.items.map((it) => ({
          href: `/items/${it.slug}`,
          name: it.name,
          badges: [it.rarity, it.mainCategory].filter(Boolean) as string[],
          sub: it.subCategory,
        }))}
      />

      <Group
        title="印记"
        basePath="/marks"
        queryParam={`q=${encodeURIComponent(q)}`}
        total={result.totals.marks}
        items={result.marks.map((m) => ({
          href: `/marks/${m.slug}`,
          name: m.name,
          badges: [m.faction].filter(Boolean) as string[],
          sub: m.effectText?.slice(0, 40),
        }))}
      />

      <Group
        title="任务"
        basePath="/quests"
        queryParam={`q=${encodeURIComponent(q)}`}
        total={result.totals.quests}
        items={result.quests.map((qs) => ({
          href: `/quests/${qs.slug}`,
          name: qs.name,
          badges: [qs.category].filter(Boolean) as string[],
          sub: qs.location,
        }))}
      />
    </div>
  );
}

interface GroupItem {
  href: string;
  name: string;
  badges?: string[];
  sub?: string;
}

function Group({
  title,
  basePath,
  queryParam,
  total,
  items,
}: {
  title: string;
  basePath: string;
  queryParam: string;
  total: number;
  items: GroupItem[];
}) {
  if (total === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {title} <span className="ml-1 text-sm font-normal text-muted-foreground">{total}</span>
        </h2>
        {total > items.length && (
          <Link
            href={`${basePath}?${queryParam}`}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            查看全部 {total} 个 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 transition-all hover:bg-surface-2 hover:shadow-[var(--shadow-card)]"
          >
            <span className="flex-1 truncate font-medium">{item.name}</span>
            {item.badges?.map((b) => (
              <span key={b} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{b}</span>
            ))}
            {item.sub && <span className="truncate text-xs text-muted-foreground">{item.sub}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
