/**
 * 通用骨架屏组件。
 *
 * <p>复用 globals.css 的 {@code .skeleton} 动画(原 .ai-skeleton),
 * 为列表页 loading.tsx 和详情页加载态提供占位。
 */

/** 单个列表卡片骨架(对齐 PetCard 的 顶色条+图区+文字行 结构)。 */
export function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="skeleton h-1 w-full" />
      <div className="flex h-32 items-center justify-center bg-surface-2">
        <div className="skeleton h-16 w-16 rounded-full" />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-4 w-20 rounded" />
      </div>
    </div>
  );
}

/** 紧凑列表项骨架(用于文章列表等横向项)。 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="skeleton h-10 w-10 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
    </div>
  );
}

/** 列表网格骨架(默认 6 列对齐 pets 列表;count 控制占位数量)。 */
export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** 通用页面标题骨架(列表页 header 占位)。 */
export function PageHeaderSkeleton() {
  return (
    <header className="mb-4">
      <div className="skeleton mb-2 h-7 w-40 rounded" />
      <div className="skeleton h-4 w-24 rounded" />
    </header>
  );
}
