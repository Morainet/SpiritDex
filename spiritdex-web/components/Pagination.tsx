import Link from "next/link";

/** 分页（page query 驱动）。 */
export default function Pagination({
  page,
  size,
  total,
  basePath,
  searchParams,
  unit = "条",
}: {
  page: number;
  size: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  /** 量词，默认「条」（精灵用「只」、技能/道具用「个」等）。 */
  unit?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (totalPages <= 1) return null;

  const window = 1;
  const pages: number[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= window) pages.push(p);
  }

  function href(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  }

  const items: React.ReactNode[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) items.push(<span key={`gap-${p}`} className="px-1 text-muted-foreground">…</span>);
    items.push(
      <Link
        key={p}
        href={href(p)}
        className={`min-w-[2rem] rounded-lg px-2 py-1 text-center text-sm transition-colors ${
          p === page ? "bg-foreground text-background" : "bg-surface-2 text-muted hover:text-foreground"
        }`}
      >
        {p}
      </Link>
    );
    prev = p;
  }

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-lg bg-surface-2 px-3 py-1 text-sm text-muted hover:text-foreground">
          上一页
        </Link>
      )}
      {items}
      {page < totalPages && (
        <Link href={href(page + 1)} className="rounded-lg bg-surface-2 px-3 py-1 text-sm text-muted hover:text-foreground">
          下一页
        </Link>
      )}
      <span className="ml-2 text-xs text-muted-foreground">
        第 {page}/{totalPages} 页 · 共 {total} {unit}
      </span>
    </nav>
  );
}
