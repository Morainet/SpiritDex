import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import type { ItemListItem } from "@/types/item";
import { itemIconUrl } from "@/lib/image";

/** 稀有度配色（紫/蓝/橙/绿）。 */
const RARITY_STYLE: Record<string, string> = {
  紫: "bg-violet-500",
  蓝: "bg-blue-500",
  橙: "bg-orange-500",
  绿: "bg-emerald-500",
};

export default function ItemCard({ item }: { item: ItemListItem }) {
  const icon = itemIconUrl(item.iconId);
  return (
    <Link
      href={`/items/${item.slug}`}
      className="flex gap-3 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2">
        {icon ? (
          <Image src={icon} alt={item.name} unoptimized width={40} height={40} className="object-contain" />
        ) : (
          <Package className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold leading-tight">{item.name}</span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {item.rarity && (
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium text-white ${RARITY_STYLE[item.rarity] ?? "bg-secondary"}`}>
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
    </Link>
  );
}
