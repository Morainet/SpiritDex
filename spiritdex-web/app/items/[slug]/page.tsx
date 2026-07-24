import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProxyImage from "@/components/ProxyImage";
import { ArrowLeft, Package, ExternalLink } from "lucide-react";
import { fetchItemDetail } from "@/lib/api";
import { itemIconUrl } from "@/lib/image";
import { ITEM_RARITY_COLOR } from "@/lib/badge-styles";

// 道具量大（约 1780），不做全量 SSG；按需动态渲染 + ISR 缓存。
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchItemDetail(slug);
  if (!item) return { title: "道具不存在" };
  return { title: `道具·${item.name}`, description: item.usageText?.slice(0, 80) };
}

export default async function ItemDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await fetchItemDetail(slug);
  if (!item) notFound();

  const icon = itemIconUrl(item.iconId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/items" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回道具图鉴
      </Link>

      <header className="mb-6 flex items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-2">
          {icon ? (
            <ProxyImage src={icon} alt={item.name} width={64} height={64} className="object-contain" fallback={<Package className="h-10 w-10 text-muted-foreground" />} />
          ) : (
            <Package className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{item.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.rarity && (
              <span
                className="rounded-md px-2 py-0.5 text-sm font-medium text-white"
                style={{ backgroundColor: ITEM_RARITY_COLOR[item.rarity] ?? "var(--secondary)" }}
              >
                {item.rarity}
              </span>
            )}
            {item.mainCategory && (
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-sm text-muted">{item.mainCategory}</span>
            )}
            {item.subCategory && (
              <span className="text-sm text-muted-foreground">{item.subCategory}</span>
            )}
          </div>
        </div>
      </header>

      {item.usageText && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">用途</h2>
          <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{item.usageText}</p>
        </section>
      )}

      {item.description && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">描述</h2>
          <p className="text-sm leading-relaxed text-muted">{item.description}</p>
        </section>
      )}

      {item.sourceText && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">获取来源</h2>
          <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{item.sourceText}</p>
        </section>
      )}

      {item.sourceUrl && (
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          数据来源：
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
            BWIKI <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </main>
  );
}
