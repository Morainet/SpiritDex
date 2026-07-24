import { ListItemSkeleton, PageHeaderSkeleton } from "@/components/Skeleton";

/** 攻略文章加载骨架。 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <PageHeaderSkeleton />
      <div className="skeleton mb-6 h-12 w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
