import type { Metadata } from "next";
import Link from "next/link";
import { fetchLocations } from "@/lib/api";

export const metadata: Metadata = {
  title: "精灵分布地区",
  description: "按地区查询精灵分布，每个地名对应可捕捉的精灵",
};

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  let locations: Awaited<ReturnType<typeof fetchLocations>> = [];
  try {
    locations = await fetchLocations();
  } catch {
    // 降级
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">精灵分布地区</h1>
        <p className="text-sm text-muted">
          共 {locations.length} 个地名。点击地名查看该地区可遇到的精灵。
        </p>
      </header>

      {locations.length === 0 ? (
        <p className="py-8 text-center text-muted">无法加载数据，请确认后端服务已启动。</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {locations.map((loc) => (
            <Link
              key={loc.location}
              href={`/pets?location=${encodeURIComponent(loc.location)}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5"
            >
              <span className="font-medium">{loc.location}</span>
              <span className="text-sm text-muted-foreground">{loc.cnt} 只精灵</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
