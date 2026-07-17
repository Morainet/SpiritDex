"use client";

import { useMemo, useState } from "react";
import ProxyImage from "@/components/ProxyImage";
import Link from "next/link";
import type { PetListItem } from "@/types/pet";
import type { SpiritType, TypeMatrix } from "@/types/spiritdex";
import { petHeadUrl } from "@/lib/image";
import { typeColor } from "@/lib/type-colors";
import { multiplier } from "@/lib/type-effectiveness";

const CN_TO_SLUG: Record<string, string> = {
  普通: "normal", 草: "grass", 火: "fire", 水: "water", 光: "light", 地: "ground",
  冰: "ice", 龙: "dragon", 电: "electric", 毒: "poison", 虫: "bug", 武: "fighting",
  翼: "flying", 萌: "cute", 幽: "ghost", 恶: "dark", 机械: "machine", 幻: "illusion",
};

const MAX_TEAM = 6;

export default function TeamBuilder({
  pets,
  matrix,
}: {
  pets: PetListItem[];
  matrix: TypeMatrix;
}) {
  const [team, setTeam] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const teamPets = team.map((s) => pets.find((p) => p.slug === s)).filter(Boolean) as PetListItem[];

  const analysis = useMemo(() => {
    // 队伍成员的属性 slug（每个成员的中文属性转 slug）
    const memberTypeSlugs = teamPets.map((p) => (p.types ?? []).map((t) => CN_TO_SLUG[t]).filter(Boolean));

    // 1) 队伍覆盖的攻击属性
    const coveredOffense = new Set<string>();
    memberTypeSlugs.forEach((slugs) => slugs.forEach((s) => coveredOffense.add(s)));

    // 2) 共同弱点：对每个属性，统计队伍里被它 2x 克制的成员数
    const weaknessCount: Record<string, number> = {};
    matrix.types.forEach((atk) => {
      let cnt = 0;
      memberTypeSlugs.forEach((defSlugs) => {
        // 该成员是否有属性被 atk 2x 克制（取最大倍率）
        const m = Math.max(1, ...defSlugs.map((d) => multiplier(matrix, atk.slug, d)));
        if (m >= 2) cnt++;
      });
      if (cnt > 0) weaknessCount[atk.slug] = cnt;
    });

    // 3) 团队优势：队伍成员能 2x 克制的属性集合
    const offenseCoverage: Record<string, number> = {};
    coveredOffense.forEach((atkSlug) => {
      matrix.types.forEach((def) => {
        if (multiplier(matrix, atkSlug, def.slug) >= 2) {
          offenseCoverage[def.slug] = (offenseCoverage[def.slug] ?? 0) + 1;
        }
      });
    });

    return { coveredOffense: [...coveredOffense], weaknessCount, offenseCoverage };
  }, [teamPets, matrix]);

  const filtered = useMemo(() => {
    const tq = q.trim();
    const available = pets.filter((p) => !team.includes(p.slug));
    if (!tq) return available.slice(0, 24);
    return available.filter((p) => p.name.includes(tq)).slice(0, 24);
  }, [q, pets, team]);

  function toggle(slug: string) {
    setTeam((t) => (t.includes(slug) ? t.filter((s) => s !== slug) : t.length < MAX_TEAM ? [...t, slug] : t));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* 左：选择区 */}
      <div>
        <div className="mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索精灵添加到队伍"
            className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.slug}
              onClick={() => toggle(p.slug)}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-left hover:bg-surface-2"
            >
              <Head pet={p} small />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
              </div>
              <span className="text-muted-foreground">+</span>
            </button>
          ))}
        </div>
      </div>

      {/* 右：队伍 + 分析 */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">我的阵容 ({team.length}/{MAX_TEAM})</h2>
            {team.length > 0 && (
              <button onClick={() => setTeam([])} className="text-xs text-muted-foreground hover:text-muted">
                清空
              </button>
            )}
          </div>
          {teamPets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">从左侧选择精灵加入队伍</p>
          ) : (
            <div className="space-y-1.5">
              {teamPets.map((p) => (
                <div key={p.slug} className="flex items-center gap-2 rounded-lg bg-surface-2 p-1.5">
                  <Head pet={p} small />
                  <Link href={`/pets/${p.slug}`} className="flex-1 text-sm hover:underline">
                    {p.name}
                  </Link>
                  <div className="flex gap-0.5">
                    {p.types?.map((t) => (
                      <span key={t} className="rounded px-1 text-[10px] text-white" style={{ backgroundColor: typeColor(t) }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <button onClick={() => toggle(p.slug)} className="text-muted-foreground hover:text-muted">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {teamPets.length > 0 && (
          <>
            {/* 共同弱点 */}
            <div className="rounded-xl border border-border bg-surface p-3">
              <h2 className="mb-2 text-sm font-semibold text-red-600">⚠ 共同弱点</h2>
              <div className="space-y-1">
                {Object.entries(analysis.weaknessCount)
                  .sort((a, b) => b[1] - a[1])
                  .map(([slug, cnt]) => (
                    <div key={slug} className="flex items-center gap-2">
                      <TypePill types={matrix.types} slug={slug} />
                      <span className="text-xs text-muted">
                        {cnt >= 3 ? "极危" : cnt >= 2 ? "高危" : "注意"}（{cnt} 只被克）
                      </span>
                    </div>
                  ))}
                {Object.keys(analysis.weaknessCount).length === 0 && (
                  <p className="text-xs text-muted-foreground">无明显共同弱点</p>
                )}
              </div>
            </div>

            {/* 攻击覆盖 */}
            <div className="rounded-xl border border-border bg-surface p-3">
              <h2 className="mb-2 text-sm font-semibold text-green-600">✓ 可克制属性</h2>
              <div className="flex flex-wrap gap-1">
                {Object.entries(analysis.offenseCoverage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([slug]) => (
                    <TypePill key={slug} types={matrix.types} slug={slug} />
                  ))}
                {Object.keys(analysis.offenseCoverage).length === 0 && (
                  <p className="text-xs text-muted-foreground">无</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Head({ pet, small }: { pet: PetListItem; small?: boolean }) {
  const url = petHeadUrl(pet.headKey);
  const sz = small ? 28 : 36;
  return url ? (
    <ProxyImage src={url} alt={pet.name} width={sz} height={sz} className="object-contain" fallback={<span className="text-lg">🐾</span>} />
  ) : (
    <span className="text-lg">🐾</span>
  );
}

function TypePill({ types, slug }: { types: SpiritType[]; slug: string }) {
  const t = types.find((x) => x.slug === slug);
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: t?.color ?? "#888" }}>
      {t?.name ?? slug}
    </span>
  );
}
