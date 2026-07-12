"use client";

import { useState } from "react";
import type { SpiritType, TypeMatrix } from "@/types/spiritdex";
import { analyzeType, multiplier } from "@/lib/type-effectiveness";

const CELL_LABEL: Record<string, string> = { "0.5": "½", "2": "2" };

function cellBg(m: number): string {
  if (m >= 2) return "color-mix(in srgb, var(--danger) 18%, transparent)";
  if (m > 0 && m < 1) return "color-mix(in srgb, var(--secondary) 18%, transparent)";
  return "transparent";
}
function cellText(m: number): string {
  if (m >= 2) return "var(--danger)";
  if (m > 0 && m < 1) return "var(--secondary)";
  return "var(--muted-foreground)";
}

/** 高亮类型：选中行的克制/被克、选中列的克制/被克。 */
function highlightClass(m: number): string | null {
  if (m >= 2) return "ring-2 ring-[var(--danger)]";
  if (m > 0 && m < 1) return "ring-2 ring-[var(--secondary)]";
  return null;
}

export default function TypeMatrixClient({ matrix }: { matrix: TypeMatrix }) {
  const [selected, setSelected] = useState<string | null>(null);
  const types = matrix.types;

  const analysis = selected ? analyzeType(matrix, types, selected) : null;
  const selName = types.find((t) => t.slug === selected)?.name;

  return (
    <>
      {/* 选中属性的分析摘要 */}
      {analysis && selName && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <AnalysisBox label={`${selName}系 克制`} types={types} slugs={analysis.strongAgainst} color="#FEE2E2" textColor="#C53030" />
          <AnalysisBox label={`${selName}系 打不动`} types={types} slugs={analysis.weakAgainst} color="#DBEAFE" textColor="#2B6CB0" />
          <AnalysisBox label={`克制 ${selName}系`} types={types} slugs={analysis.counteredBy} color="#FEE2E2" textColor="#C53030" />
          <AnalysisBox label={`打 ${selName}系 减半`} types={types} slugs={analysis.resistedBy} color="#DBEAFE" textColor="#2B6CB0" />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface"></th>
              {types.map((t) => (
                <th key={t.slug} className="h-14 w-9">
                  <button
                    onClick={() => setSelected(selected === t.slug ? null : t.slug)}
                    className="h-10 w-9 rounded text-xs font-medium text-white transition-transform hover:scale-110"
                    style={{
                      backgroundColor: t.color,
                      outline: selected === t.slug ? "2px solid #111" : "none",
                      outlineOffset: 1,
                    }}
                    title={`点击分析 ${t.name}系`}
                  >
                    {t.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((atk) => (
              <tr key={atk.slug}>
                <th className="sticky left-0">
                  <button
                    onClick={() => setSelected(selected === atk.slug ? null : atk.slug)}
                    className="h-9 w-11 rounded text-xs font-medium text-white transition-transform hover:scale-105"
                    style={{
                      backgroundColor: atk.color,
                      outline: selected === atk.slug ? "2px solid #111" : "none",
                      outlineOffset: 1,
                    }}
                  >
                    {atk.name}
                  </button>
                </th>
                {types.map((def) => {
                  const m = multiplier(matrix, atk.slug, def.slug);
                  const hl = selected && (selected === atk.slug || selected === def.slug) ? highlightClass(m) : null;
                  return (
                    <td
                      key={def.slug}
                      className={`h-9 w-9 rounded text-center align-middle text-sm font-semibold ${hl ?? ""}`}
                      style={{ backgroundColor: cellBg(m), color: cellText(m) }}
                      title={`${atk.name} 攻击 ${def.name}：${m}x`}
                    >
                      {m === 1 ? "" : (CELL_LABEL[String(m)] ?? String(m))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        未标注的格子为 1.0 倍（正常伤害）。点击行/列头属性查看完整克制分析。数据来源：BWIKI。
      </p>
    </>
  );
}

function AnalysisBox({
  label,
  types,
  slugs,
  color,
  textColor,
}: {
  label: string;
  types: SpiritType[];
  slugs: string[];
  color: string;
  textColor: string;
}) {
  return (
    <div className="rounded-lg p-2" style={{ backgroundColor: color }}>
      <div className="mb-1 text-xs font-semibold" style={{ color: textColor }}>
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
