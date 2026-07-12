import type { PetDetail } from "@/types/pet";

/** 手写 SVG 六维种族值雷达图（深色适配：用 CSS 变量 currentColor）。 */

const STAT_META: { key: keyof NonNullable<PetDetail["baseStats"]>; label: string }[] = [
  { key: "hp", label: "体力" }, { key: "atk", label: "物攻" }, { key: "spa", label: "魔攻" },
  { key: "spe", label: "速度" }, { key: "sdf", label: "魔防" }, { key: "def", label: "物防" },
];

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 78;
const MAX = 160;
const RINGS = [0.25, 0.5, 0.75, 1];

function point(angle: number, r: number) {
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

export default function StatsRadar({ baseStats }: { baseStats?: Record<string, number> }) {
  if (!baseStats) return null;
  const values = STAT_META.map((m) => Number(baseStats[m.key] ?? 0));

  const pts = STAT_META.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_META.length;
    const r = (Math.min(values[i], MAX) / MAX) * RADIUS;
    return point(angle, r);
  });
  const polygon = pts.map((p) => p.join(",")).join(" ");

  return (
    // 父元素颜色驱动 currentColor（浅色 #9ca3af / 深色 #9ca3af），低透明度做网格
    <div className="text-muted-foreground" style={{ color: "var(--muted-foreground)" }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="种族值雷达图">
        {/* 背景环 + 轴线：currentColor 低透明 */}
        {RINGS.map((ring, idx) => {
          const ringPts = STAT_META.map((_, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_META.length;
            return point(angle, RADIUS * ring).join(",");
          }).join(" ");
          return <polygon key={idx} points={ringPts} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />;
        })}
        {STAT_META.map((_, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_META.length;
          const [x, y] = point(angle, RADIUS);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />;
        })}
        {/* 数据多边形：用 secondary 色变量 */}
        <polygon points={polygon} fill="var(--secondary)" fillOpacity={0.25} stroke="var(--secondary)" strokeWidth={2} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="var(--secondary)" />)}
        {/* 标签 + 数值 */}
        {STAT_META.map((m, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAT_META.length;
          const [lx, ly] = point(angle, RADIUS + 18);
          return (
            <text key={m.key} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="currentColor" className="text-[11px]">
              {m.label}
              <tspan x={lx} dy={13} fill="var(--foreground)" fontWeight={600}>{values[i]}</tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}
