import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { TypeMatrix, SpiritType } from "@/types/spiritdex";
import { combinedMultiplier } from "@/lib/type-effectiveness";

/**
 * 精灵详情页的属性相克区块。
 *
 * 纯展示（Server Component 友好）：给定精灵的中文名属性列表 + 全站矩阵，
 * 算出这只精灵「被谁克 / 抗什么」，以及它本系「克什么 / 打不动什么」。
 *
 * 关键点：pet.types 是中文名（如"草"），矩阵 multipliers 的 key 是 slug（如"grass"），
 * 这里用 matrix.types 里的 {name, slug} 现场建 name→slug 映射做桥接。
 */
export default function TypeMatchup({
  petTypes,
  matrix,
}: {
  petTypes: string[];
  matrix: TypeMatrix;
}) {
  const types = matrix.types;
  const byName = new Map<string, SpiritType>();
  for (const t of types) byName.set(t.name, t);

  // 精灵持有的属性 slug（过滤掉矩阵里没有的，避免脏数据）
  const ownSlugs = petTypes.map((n) => byName.get(n)?.slug).filter((s): s is string => !!s);
  if (ownSlugs.length === 0) return null;

  // —— 防御维度：每个攻击属性打「这只精灵全部属性」的合并倍率 ——
  // 弱点=被克（≥2x），抗性=减半（≤0.5x）。这是玩家最关心的「我怕什么」。
  const weakTo: string[] = [];   // 被这些属性 2x 克制
  const resistFrom: string[] = []; // 抗这些属性（受 ≤0.5x）
  for (const atk of types) {
    const m = combinedMultiplier(matrix, atk.slug, ownSlugs);
    if (m >= 2) weakTo.push(atk.slug);
    else if (m > 0 && m < 1) resistFrom.push(atk.slug);
  }

  // —— 进攻维度：精灵本系技能克什么 / 打不动什么（合并它所有持有属性）——
  // 单属性直接取该属性的攻防关系；双属性取并集（任一本系能 2x 即算覆盖）。
  const covers: Set<string> = new Set();   // 本系能 2x 打的属性
  const walledBy: Set<string> = new Set(); // 本系打它减半的属性
  for (const atk of ownSlugs) {
    for (const def of types) {
      const m = combinedMultiplier(matrix, atk, [def.slug]);
      if (m >= 2) covers.add(def.slug);
      else if (m > 0 && m < 1) walledBy.add(def.slug);
    }
  }

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-bold">属性相克</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Box
          label="弱点（被克 · 受 2x）"
          tone="danger"
          types={types}
          slugs={weakTo}
        />
        <Box
          label="抗性（受减半 · ≤½x）"
          tone="secondary"
          types={types}
          slugs={resistFrom}
        />
        <Box
          label="本系克制（打出 2x）"
          tone="danger"
          types={types}
          slugs={[...covers]}
        />
        <Box
          label="本系打不动（减半 · ≤½x）"
          tone="secondary"
          types={types}
          slugs={[...walledBy]}
        />
      </div>
      <Link
        href="/types/matrix"
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        查看完整属性相克表 <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

/** 单个相克分组：标题（红/蓝）+ 属性 chip 流式排列。chip 颜色取 matrix 里的 canonical 色。 */
function Box({
  label,
  tone,
  types,
  slugs,
}: {
  label: string;
  tone: "danger" | "secondary";
  types: SpiritType[];
  slugs: string[];
}) {
  const textColor = tone === "danger" ? "var(--danger)" : "var(--secondary)";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 text-xs font-semibold" style={{ color: textColor }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {slugs.length === 0 ? (
          <span className="text-xs text-muted-foreground">无</span>
        ) : (
          slugs.map((s) => {
            const t = types.find((x) => x.slug === s);
            return (
              <span
                key={s}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: t?.color ?? "#888" }}
              >
                {t?.name ?? s}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
