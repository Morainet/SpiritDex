import Link from "next/link";
import { Package } from "lucide-react";
import type { ItemListItem } from "@/types/item";
import { itemIconUrl } from "@/lib/image";
import ProxyImage from "@/components/ProxyImage";
import { ITEM_RARITY_COLOR } from "@/lib/badge-styles";

export default function ItemCard({ item }: { item: ItemListItem }) {
  const icon = itemIconUrl(item.iconId);
  // 稀有度色作顶条(对齐其它 Card 的顶色条范式)
  const rarityColor = item.rarity ? ITEM_RARITY_COLOR[item.rarity] ?? "var(--muted)" : "var(--muted)";

  return (
    <Link
      href={`/items/${item.slug}`}
      style={{ ["--card-color" as string]: rarityColor }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] sd-transition hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--card-color)_40%,var(--border))] hover:shadow-[0_12px_28px_color-mix(in_srgb,var(--card-color)_22%,rgba(0,0,0,0.12))]"
    >
      {/* 稀有度色顶条 */}
      <div className="h-1" style={{ backgroundColor: rarityColor }} />

      <div className="flex gap-3 p-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-2 transition-transform duration-200 group-hover:scale-105">
          {icon ? (
            <ProxyImage src={icon} alt={item.name} fill className="object-contain p-1.5" fallback={<Package className="h-7 w-7 text-muted-foreground" />} />
          ) : (
            <Package className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-semibold leading-tight">{item.name}</span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {item.rarity && (
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: rarityColor }}
              >
                {item.rarity}
              </span>
            )}
            {item.mainCategory && (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{item.mainCategory}</span>
            )}
            {item.subCategory && (
              <span className="text-[11px] text-muted-foreground">{item.subCategory}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
