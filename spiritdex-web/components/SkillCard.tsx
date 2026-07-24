import Link from "next/link";
import { Zap } from "lucide-react";
import type { SkillListItem } from "@/types/skill";
import { typeColor } from "@/lib/type-colors";
import { SKILL_CATEGORY_COLOR } from "@/lib/badge-styles";

export default function SkillCard({ skill }: { skill: SkillListItem }) {
  const color = skill.category ? SKILL_CATEGORY_COLOR[skill.category] ?? "var(--muted)" : "var(--muted)";

  return (
    <Link
      href={`/skills/${skill.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      {/* 类别色顶条 */}
      <div className="h-1" style={{ backgroundColor: color }} />

      {/* 图标方块区 */}
      <div className="flex h-24 items-center justify-center bg-surface-2">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: color }}
        >
          <Zap className="h-6 w-6" />
        </span>
        {skill.category && (
          <span
            className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {skill.category}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        <span className="font-semibold leading-tight">{skill.name}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {skill.element && (
            <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: typeColor(skill.element) }}>
              {skill.element}
            </span>
          )}
          {skill.power != null && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
              威力 <span className="font-medium text-foreground">{skill.power}</span>
            </span>
          )}
          {skill.energy != null && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
              能耗 <span className="font-medium text-foreground">{skill.energy}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
