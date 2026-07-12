import Link from "next/link";
import type { SkillListItem } from "@/types/skill";
import { typeColor } from "@/lib/type-colors";

const CATEGORY_STYLE: Record<string, string> = {
  特性: "bg-[var(--type-poison)]",
  攻击: "bg-[var(--type-fire)]",
  变化: "bg-secondary",
  防御: "bg-[var(--type-grass)]",
};

export default function SkillCard({ skill }: { skill: SkillListItem }) {
  return (
    <Link
      href={`/skills/${skill.slug}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold leading-tight">{skill.name}</span>
        {skill.category && (
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white ${CATEGORY_STYLE[skill.category] ?? "bg-surface-2 text-muted"}`}>
            {skill.category}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        {skill.element && (
          <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: typeColor(skill.element) }}>
            {skill.element}
          </span>
        )}
        {skill.power != null && <span>威力 {skill.power}</span>}
        {skill.energy != null && <span>能耗 {skill.energy}</span>}
      </div>
    </Link>
  );
}
