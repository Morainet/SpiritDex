import Link from "next/link";
import { MapPin } from "lucide-react";
import type { QuestListItem } from "@/types/quest";

/** 任务分类配色（旅途/奇谭/拾遗）。 */
const CATEGORY_STYLE: Record<string, string> = {
  旅途: "bg-blue-500",
  奇谭: "bg-violet-500",
  拾遗: "bg-emerald-500",
};

export default function QuestCard({ quest }: { quest: QuestListItem }) {
  return (
    <Link
      href={`/quests/${quest.slug}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold leading-tight">{quest.name}</span>
        {quest.category && (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white ${CATEGORY_STYLE[quest.category] ?? "bg-secondary"}`}>
            {quest.category}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        {quest.seq && <span className="font-mono text-[11px]">{quest.seq}</span>}
        {quest.location && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {quest.location}
          </span>
        )}
      </div>
    </Link>
  );
}
