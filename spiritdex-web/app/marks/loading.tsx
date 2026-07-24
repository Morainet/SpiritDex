import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/Skeleton";

/** 印记图鉴加载骨架。 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeaderSkeleton />
      <div className="skeleton mb-6 h-16 w-full rounded-xl" />
      <CardGridSkeleton count={12} />
    </main>
  );
}
