import Link from "next/link";
import { MapPin, Scroll } from "lucide-react";
import type { QuestListItem } from "@/types/quest";
import { QUEST_CATEGORY_COLOR } from "@/lib/badge-styles";

export default function QuestCard({ quest }: { quest: QuestListItem }) {
  const color = quest.category ? QUEST_CATEGORY_COLOR[quest.category] ?? "var(--muted)" : "var(--muted)";

  return (
    <Link
      href={`/quests/${quest.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      {/* 分类色顶条 */}
      <div className="h-1" style={{ backgroundColor: color }} />

      {/* 图标方块区 */}
      <div className="flex h-24 items-center justify-center bg-surface-2">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: color }}
        >
          <Scroll className="h-6 w-6" />
        </span>
        {quest.category && (
          <span
            className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {quest.category}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        <span className="font-semibold leading-tight">{quest.name}</span>
        <div className="flex items-center gap-2 text-xs text-muted">
          {quest.seq && <span className="font-mono text-[11px]">{quest.seq}</span>}
          {quest.location && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {quest.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
