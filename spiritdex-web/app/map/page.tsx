import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchMapPoints, fetchMapTypes, fetchLocations } from "@/lib/api";
import MapView from "@/components/MapView";

export const metadata: Metadata = {
  title: "地图",
  description: "洛克王国手游地图点位（庇护所/宝箱/资源点）与精灵分布",
};

export const dynamic = "force-dynamic";

export default async function MapPage() {
  // 预取：地图点位 + 类型统计 + 分布地区聚合（容错）
  let points: Awaited<ReturnType<typeof fetchMapPoints>> = [];
  let types: Awaited<ReturnType<typeof fetchMapTypes>> = [];
  let locations: Awaited<ReturnType<typeof fetchLocations>> = [];
  try {
    [points, types, locations] = await Promise.all([
      fetchMapPoints(),
      fetchMapTypes(),
      fetchLocations(),
    ]);
  } catch {
    // 后端不可用降级
  }

  const totalPoints = types.reduce((s, t) => s + t.count, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">地图</h1>
        <p className="text-sm text-muted">
          游戏内点位分布（{totalPoints} 个）与精灵分布地区（{locations.length} 个地名）。坐标系来自 BWIKI 社区数据，无官方底图，以网格示意。
        </p>
      </header>

      {points.length === 0 ? (
        <p className="py-8 text-center text-muted">无法加载地图数据，请确认后端服务已启动。</p>
      ) : (
        <>
          {/* 点位类型统计 */}
          <section className="mb-6 flex flex-wrap gap-2">
            {types.map((t) => (
              <span key={t.markType} className="rounded-lg bg-surface-2 px-3 py-1 text-sm">
                {t.typeName} <span className="text-muted-foreground">{t.count}</span>
              </span>
            ))}
          </section>

          {/* 交互地图 */}
          <section className="mb-8">
            <MapView points={points} />
          </section>

          {/* 精灵分布地区 */}
          {locations.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold">精灵分布地区</h2>
                <Link href="/locations" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
                  查看全部 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="mb-3 text-sm text-muted">点击地名查看该地区的精灵（共 {locations.length} 个地名）</p>
              <div className="flex flex-wrap gap-2">
                {locations.slice(0, 40).map((loc) => (
                  <Link
                    key={loc.location}
                    href={`/pets?location=${encodeURIComponent(loc.location)}`}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5"
                  >
                    {loc.location} <span className="ml-1 text-xs text-muted-foreground">{loc.cnt}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
