"use client";

import { useMemo, useState } from "react";
import type { PetListItem, PetStats } from "@/types/pet";
import PetSelect from "@/components/PetSelect";
import StatsRadar from "@/components/StatsRadar";

// 六维 key 与中文标签（与 StatsRadar 对齐）
const STAT_META: { key: keyof NonNullable<PetStats["baseStats"]>; label: string }[] = [
  { key: "hp", label: "生命" },
  { key: "atk", label: "物攻" },
  { key: "def", label: "物防" },
  { key: "spa", label: "魔攻" },
  { key: "sdf", label: "魔防" },
  { key: "spe", label: "速度" },
];

// 性格标签 → baseStats key 的映射（中文维度名 → 英文 key）
const DIM_TO_KEY: Record<string, keyof NonNullable<PetStats["baseStats"]>> = {
  生命: "hp", 物攻: "atk", 物防: "def", 魔攻: "spa", 魔防: "sdf", 速度: "spe",
};

/** 30 种性格：[名称, 增加的维度, 减少的维度]。来自机制知识库性格表。 */
const NATURES: [string, string, string][] = [
  ["大胆", "物攻", "物防"], ["固执", "物攻", "魔攻"], ["调皮", "物攻", "魔防"], ["勇敢", "物攻", "速度"], ["逞强", "物攻", "生命"],
  ["稳重", "物防", "物攻"], ["天真", "物防", "魔攻"], ["懒散", "物防", "魔防"], ["悠闲", "物防", "速度"], ["坦率", "物防", "生命"],
  ["聪明", "魔攻", "物攻"], ["专注", "魔攻", "物防"], ["偏执", "魔攻", "魔防"], ["冷静", "魔攻", "速度"], ["理性", "魔攻", "生命"],
  ["警惕", "魔防", "物攻"], ["温顺", "魔防", "物防"], ["害羞", "魔防", "魔攻"], ["慎重", "魔防", "速度"], ["焦虑", "魔防", "生命"],
  ["胆小", "速度", "物攻"], ["急躁", "速度", "物防"], ["开朗", "速度", "魔攻"], ["莽撞", "速度", "魔防"], ["热情", "速度", "生命"],
  ["沉默", "生命", "物攻"], ["忧郁", "生命", "物防"], ["平和", "生命", "魔攻"], ["粗心", "生命", "魔防"], ["踏实", "生命", "速度"],
];

/** 性格修正：增加 ×1.1，减少 ×0.9，其余不变（向下取整）。 */
function applyNature(
  base: Record<string, number>,
  nature: [string, string, string] | null,
): Record<string, number> {
  if (!nature) return { ...base };
  const [, plus, minus] = nature;
  const result: Record<string, number> = {};
  for (const m of STAT_META) {
    let v = base[m.key] ?? 0;
    if (plus === m.label) v = Math.floor(v * 1.1);
    else if (minus === m.label) v = Math.floor(v * 0.9);
    result[m.key] = v;
  }
  return result;
}

export default function NatureCalculator({
  pets,
  detailMap,
}: {
  pets: PetListItem[];
  detailMap: Record<string, PetStats>;
}) {
  const [slug, setSlug] = useState<string | undefined>();
  const [natureName, setNatureName] = useState<string>("");

  const pet = slug ? detailMap[slug] : undefined;
  const nature = NATURES.find((n) => n[0] === natureName) ?? null;

  const { original, modified, diffs } = useMemo(() => {
    if (!pet?.baseStats) return { original: null, modified: null, diffs: [] };
    const orig = pet.baseStats;
    const mod = applyNature(orig, nature);
    const d = STAT_META.map((m) => ({
      label: m.label,
      orig: orig[m.key] ?? 0,
      mod: mod[m.key] ?? 0,
      diff: (mod[m.key] ?? 0) - (orig[m.key] ?? 0),
    }));
    return { original: orig, modified: mod, diffs: d };
  }, [pet, nature]);

  // 智能推荐：找出「增加最高维、减少最低维」的性格
  const recommendations = useMemo(() => {
    if (!pet?.baseStats) return [];
    const entries = STAT_META.map((m) => ({ label: m.label, val: pet.baseStats![m.key] ?? 0 }));
    const sorted = [...entries].sort((a, b) => b.val - a.val);
    const top = sorted[0].label; // 最高维
    const bottom = sorted[sorted.length - 1].label; // 最低维
    // 找 +top -bottom 的性格；没有则推荐 +top 减任意非 top 的
    const exact = NATURES.filter((n) => n[1] === top && n[2] === bottom);
    if (exact.length > 0) return exact;
    return NATURES.filter((n) => n[1] === top && n[2] !== top).slice(0, 3);
  }, [pet]);

  return (
    <div className="space-y-6">
      {/* 精灵选择 */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <PetSelect pets={pets} label="选择精灵" selectedSlug={slug} onSelect={setSlug} />
      </section>

      {!pet ? (
        <p className="py-8 text-center text-muted">请先选择一只精灵</p>
      ) : !pet.baseStats ? (
        <p className="py-8 text-center text-muted">该精灵暂无种族值数据</p>
      ) : (
        <>
          {/* 性格选择 */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <label className="mb-2 block text-sm text-muted">选择性格</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setNatureName("")}
                className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${natureName === "" ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
              >
                中性（无修正）
              </button>
              {NATURES.map(([name, plus, minus]) => (
                <button
                  key={name}
                  onClick={() => setNatureName(name)}
                  title={`+${plus} / -${minus}`}
                  className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${natureName === name ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          {/* 推荐性格 */}
          {recommendations.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold">💡 推荐性格（基于种族值分布）</h3>
              <div className="flex flex-wrap gap-2">
                {recommendations.map((n) => (
                  <button
                    key={n[0]}
                    onClick={() => setNatureName(n[0])}
                    className="rounded-lg bg-[var(--type-grass)] px-3 py-1.5 text-sm font-medium text-white transition-transform hover:scale-105"
                  >
                    {n[0]} <span className="opacity-80">+{n[1]}/-{n[2]}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                原则：增加种族值最高的维度，减少种族值最低的维度。具体选择需结合技能池（物攻/魔攻）和战术定位。
              </p>
            </section>
          )}

          {/* 雷达图对比 + 数值表 */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold">种族值雷达图{nature ? `（${nature[0]} 修正后）` : ""}</h3>
              <div className="flex justify-center">
                <StatsRadar baseStats={modified ?? undefined} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="mb-3 text-sm font-semibold">六维数值对比</h3>
              <div className="space-y-2">
                {diffs.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="w-10 text-sm text-muted">{d.label}</span>
                    <span className="w-12 text-right font-mono text-sm">{d.orig}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="w-12 font-mono text-sm font-semibold">{d.mod}</span>
                    {d.diff !== 0 && (
                      <span className={`text-xs font-medium ${d.diff > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {d.diff > 0 ? "+" : ""}{d.diff}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                性格修正规则：增加项 ×1.1，减少项 ×0.9（向下取整）。种族值总和：{diffs.reduce((s, d) => s + d.orig, 0)} → {diffs.reduce((s, d) => s + d.mod, 0)}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
