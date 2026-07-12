"use client";

import { useMemo, useState } from "react";
import type { PetDetail, PetListItem } from "@/types/pet";
import type { SpiritType } from "@/types/spiritdex";
import type { TypeMatrix } from "@/types/spiritdex";
import { combinedMultiplier, multiplier } from "@/lib/type-effectiveness";
import PetSelect from "@/components/PetSelect";

const CN_TO_SLUG: Record<string, string> = {
  普通: "normal", 草: "grass", 火: "fire", 水: "water", 光: "light", 地: "ground",
  冰: "ice", 龙: "dragon", 电: "electric", 毒: "poison", 虫: "bug", 武: "fighting",
  翼: "flying", 萌: "cute", 幽: "ghost", 恶: "dark", 机械: "machine", 幻: "illusion",
};

function typesToSlugs(types?: string[]): string[] {
  return (types ?? []).map((t) => CN_TO_SLUG[t]).filter(Boolean);
}

export default function DamageCalculator({
  pets,
  detailMap,
  matrix,
}: {
  pets: PetListItem[];
  detailMap: Record<string, PetDetail>;
  matrix: TypeMatrix;
}) {
  const [atkSlug, setAtkSlug] = useState<string | undefined>();
  const [defSlug, setDefSlug] = useState<string | undefined>();
  const [power, setPower] = useState(80);
  const [atkKind, setAtkKind] = useState<"physical" | "special">("physical");
  const [level, setLevel] = useState(50);

  const atkPet = atkSlug ? detailMap[atkSlug] : undefined;
  const defPet = defSlug ? detailMap[defSlug] : undefined;

  const result = useMemo(() => {
    if (!atkPet || !defPet) return null;

    const atkStat = atkKind === "physical" ? atkPet.baseStats?.atk ?? 0 : atkPet.baseStats?.spa ?? 0;
    const defStat = atkKind === "physical" ? defPet.baseStats?.def ?? 0 : defPet.baseStats?.sdf ?? 0;

    // 基础伤害公式（简化版，参考宝可梦主流公式）
    const base = ((2 * level) / 5 + 2) * power * (atkStat / Math.max(1, defStat)) / 50 + 2;

    // 相克倍率：攻击方技能属性（这里用攻击精灵主属性近似）对防御方全部属性
    const atkTypeSlugs = typesToSlugs(atkPet.types);
    const defTypeSlugs = typesToSlugs(defPet.types);
    // 用攻击方主属性计算倍率（若无属性则 1.0）
    const atkPrimary = atkTypeSlugs[0];
    const mult = atkPrimary ? combinedMultiplier(matrix, atkPrimary, defTypeSlugs) : 1;

    const damage = Math.floor(base * mult);
    return {
      base: Math.floor(base),
      mult,
      damage,
      atkStat,
      defStat,
      breakdown: defTypeSlugs.map((d) => ({ def: d, m: atkPrimary ? multiplier(matrix, atkPrimary, d) : 1 })),
    };
  }, [atkPet, defPet, power, atkKind, level, matrix]);

  return (
    <div className="space-y-6">
      {/* 选择区 */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <PetSelect pets={pets} label="攻击方精灵" selectedSlug={atkSlug} onSelect={setAtkSlug} />
        <PetSelect pets={pets} label="防御方精灵" selectedSlug={defSlug} onSelect={setDefSlug} />
      </div>

      {/* 参数区 */}
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-muted">技能威力</label>
          <input
            type="number"
            value={power}
            onChange={(e) => setPower(Math.max(0, Number(e.target.value)))}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">伤害类别</label>
          <div className="flex gap-2">
            {(["physical", "special"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setAtkKind(k)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  atkKind === k ? "bg-foreground text-white" : "bg-surface-2 text-muted hover:bg-surface-2"
                }`}
              >
                {k === "physical" ? "物攻" : "魔攻"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">等级</label>
          <input
            type="number"
            value={level}
            onChange={(e) => setLevel(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* 结果区 */}
      {!result ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
          请选择攻击方与防御方精灵
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-muted">预估伤害</span>
            <span className="text-4xl font-bold text-foreground">{result.damage}</span>
            <span className="text-sm text-muted-foreground">（基础 {result.base} × 相克 {result.mult}x）</span>
          </div>

          {/* 相克明细 */}
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-muted">相克倍率明细</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>{atkPet!.name}</span>
              <TypeBadge types={matrix.types} slug={typesToSlugs(atkPet!.types)[0]} />
              <span className="text-muted-foreground">→</span>
              {result.breakdown.map((b) => (
                <TypeBadge key={b.def} types={matrix.types} slug={b.def} mult={b.m} />
              ))}
              <span className="ml-2 rounded bg-surface-2 px-2 py-0.5 font-mono">= {result.mult}x</span>
            </div>
          </div>

          {/* 参数回显 */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-muted sm:grid-cols-4">
            <Stat label={atkKind === "physical" ? "攻击物攻" : "攻击魔攻"} value={result.atkStat} />
            <Stat label={atkKind === "physical" ? "防御物防" : "防御魔防"} value={result.defStat} />
            <Stat label="威力" value={power} />
            <Stat label="等级" value={level} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            注：技能属性取攻击精灵主属性近似；实际技能可能为任意属性。公式为简化版，不含特性/天气/暴击。
          </p>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ types, slug, mult }: { types: SpiritType[]; slug?: string; mult?: number }) {
  if (!slug) return null;
  const t = types.find((x) => x.slug === slug);
  const m = mult ?? 1;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: m >= 2 ? "#C53030" : m < 1 ? "#2B6CB0" : t?.color ?? "#888" }}
      title={t ? `${t.name}系 ${m}x` : undefined}
    >
      {t?.name ?? slug}
      {m !== 1 && ` ${m}x`}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}
