import Link from "next/link";
import { Stamp } from "lucide-react";
import type { MarkListItem } from "@/types/mark";
import { MARK_FACTION_COLOR } from "@/lib/badge-styles";

export default function MarkCard({ mark }: { mark: MarkListItem }) {
  // 阵营色(正面=蓝/负面=红),用作顶条+图标方块+badge 三处呼应
  const color = mark.faction ? MARK_FACTION_COLOR[mark.faction] ?? "var(--muted)" : "var(--muted)";

  return (
    <Link
      href={`/marks/${mark.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      {/* 阵营色顶条(对齐 PetCard 范式) */}
      <div className="h-1" style={{ backgroundColor: color }} />

      {/* 图标方块区(印记无图,用阵营色图标方块替代简陋纯文字) */}
      <div className="flex h-24 items-center justify-center bg-surface-2">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: color }}
        >
          <Stamp className="h-6 w-6" />
        </span>
        {mark.faction && (
          <span
            className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {mark.faction}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        <span className="font-semibold leading-tight">{mark.name}</span>
        {mark.effectText && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">{mark.effectText}</p>
        )}
      </div>
    </Link>
  );
}
