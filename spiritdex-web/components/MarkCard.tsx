import Link from "next/link";
import type { MarkListItem } from "@/types/mark";

/** 阵营配色：正面=蓝，负面=红。 */
const FACTION_STYLE: Record<string, string> = {
  正面: "bg-blue-500",
  负面: "bg-rose-500",
};

export default function MarkCard({ mark }: { mark: MarkListItem }) {
  return (
    <Link
      href={`/marks/${mark.slug}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold leading-tight">{mark.name}</span>
        {mark.faction && (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white ${FACTION_STYLE[mark.faction] ?? "bg-secondary"}`}>
            {mark.faction}
          </span>
        )}
      </div>
      {mark.effectText && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted">{mark.effectText}</p>
      )}
    </Link>
  );
}
