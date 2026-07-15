"use client";

import { useMemo, useState } from "react";
import type { MapPoint } from "@/types/map";

// 点位类型配色（按 markType 区分）
const TYPE_COLORS: Record<number, string> = {
  201: "var(--type-grass)",   // 大型庇护所 - 绿
  210: "var(--type-grass)",   // 小型庇护所 - 绿
  208: "var(--type-fighting)",// 力气测试仪 - 武
  303: "var(--type-fire)",    // 珍贵宝箱 - 火
  711: "var(--type-poison)",  // 伞伞菌 - 毒
  801: "var(--type-grass)",   // 智慧树苗 - 绿
  802: "var(--type-water)",   // 眠枭之星(蓝) - 水
  803: "var(--type-electric)",// 眠枭之星(黄) - 电
  807: "var(--type-fire)",    // 可可果树 - 火
  810: "var(--type-cute)",    // 乐谱 - 萌
};

const VIEW_SIZE = 600; // SVG 画布尺寸
const WORLD_RANGE = 3500; // 坐标世界范围（-3500~3500，留余量）

function worldToSvg(lat: number, lng: number): [number, number] {
  // 游戏内 lat=y（南北）、lng=x（东西），映射到 SVG 坐标
  const x = ((lng + WORLD_RANGE) / (2 * WORLD_RANGE)) * VIEW_SIZE;
  const y = VIEW_SIZE - ((lat + WORLD_RANGE) / (2 * WORLD_RANGE)) * VIEW_SIZE; // y 翻转
  return [x, y];
}

export default function MapView({ points }: { points: MapPoint[] }) {
  const [visibleTypes, setVisibleTypes] = useState<Set<number>>(() => {
    // 默认全部显示
    return new Set(points.map((p) => p.markType));
  });
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [zoom, setZoom] = useState(1);

  // 类型列表（去重 + 计数）
  const typeList = useMemo(() => {
    const m = new Map<number, { name: string; count: number }>();
    for (const p of points) {
      const e = m.get(p.markType) ?? { name: p.typeName, count: 0 };
      e.count++;
      m.set(p.markType, e);
    }
    return [...m.entries()].map(([markType, v]) => ({ markType, ...v }));
  }, [points]);

  const filtered = useMemo(
    () => points.filter((p) => visibleTypes.has(p.markType)),
    [points, visibleTypes],
  );

  function toggleType(t: number) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
      {/* 地图 */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm text-muted">
            坐标系为游戏内坐标（来自 BWIKI 社区），无官方底图，以网格示意
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))} className="rounded px-2 py-0.5 text-sm bg-surface-2 hover:bg-surface-3">−</button>
            <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="rounded px-2 py-0.5 text-sm bg-surface-2 hover:bg-surface-3">+</button>
          </div>
        </div>
        <div className="flex justify-center p-2" style={{ overflow: "auto" }}>
          <svg
            width={VIEW_SIZE}
            height={VIEW_SIZE}
            viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
            style={{ transform: `scale(${zoom})`, transformOrigin: "center", maxWidth: "100%" }}
            className="touch-none"
          >
            {/* 网格背景 */}
            <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="var(--background)" />
            {Array.from({ length: 11 }, (_, i) => i * (VIEW_SIZE / 10)).map((pos) => (
              <g key={pos}>
                <line x1={pos} y1={0} x2={pos} y2={VIEW_SIZE} stroke="var(--border)" strokeOpacity={0.4} strokeWidth={1} />
                <line x1={0} y1={pos} x2={VIEW_SIZE} y2={pos} stroke="var(--border)" strokeOpacity={0.4} strokeWidth={1} />
              </g>
            ))}
            {/* 中心十字（原点） */}
            <line x1={VIEW_SIZE / 2} y1={0} x2={VIEW_SIZE / 2} y2={VIEW_SIZE} stroke="var(--muted-foreground)" strokeOpacity={0.3} strokeWidth={1.5} />
            <line x1={0} y1={VIEW_SIZE / 2} x2={VIEW_SIZE} y2={VIEW_SIZE / 2} stroke="var(--muted-foreground)" strokeOpacity={0.3} strokeWidth={1.5} />

            {/* 点位 */}
            {filtered.map((p, i) => {
              const [cx, cy] = worldToSvg(p.lat, p.lng);
              const color = TYPE_COLORS[p.markType] ?? "var(--muted)";
              const isSel = selected?.lat === p.lat && selected?.lng === p.lng;
              return (
                <g key={i}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSel ? 6 : 4}
                    fill={color}
                    stroke={isSel ? "var(--foreground)" : "none"}
                    strokeWidth={isSel ? 1.5 : 0}
                    className="cursor-pointer transition-all hover:opacity-80"
                    onClick={() => setSelected(p)}
                  >
                    <title>{p.title || p.typeName}{p.description ? `：${p.description}` : ""}</title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 右侧：类型筛选 + 选中详情 */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-3">
          <h3 className="mb-2 text-sm font-semibold">点位类型（点击切换显示）</h3>
          <div className="space-y-1.5">
            {typeList.map((t) => (
              <button
                key={t.markType}
                onClick={() => toggleType(t.markType)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors ${
                  visibleTypes.has(t.markType) ? "bg-surface-2" : "opacity-40"
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[t.markType] ?? "var(--muted)" }} />
                <span className="flex-1">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="rounded-xl border border-border bg-surface p-3">
            <h3 className="mb-1 text-sm font-semibold">{selected.title || selected.typeName}</h3>
            <p className="text-xs text-muted">
              <span className="rounded px-1 text-white" style={{ backgroundColor: TYPE_COLORS[selected.markType] ?? "var(--muted)" }}>{selected.typeName}</span>
            </p>
            {selected.description && <p className="mt-2 text-sm text-muted">{selected.description}</p>}
            <p className="mt-2 font-mono text-xs text-muted-foreground">坐标 ({selected.lat.toFixed(1)}, {selected.lng.toFixed(1)})</p>
            <button onClick={() => setSelected(null)} className="mt-2 text-xs text-muted-foreground underline hover:text-foreground">关闭</button>
          </div>
        )}
      </div>
    </div>
  );
}
