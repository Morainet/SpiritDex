"use client";

import { useMemo, useState } from "react";
import ProxyImage from "@/components/ProxyImage";
import type { PetListItem } from "@/types/pet";
import { petHeadUrl } from "@/lib/image";
import { typeColor } from "@/lib/type-colors";

/**
 * 精灵搜索选择器（带头像下拉）。
 * 从预加载的全部精灵中按名字搜索，选中后回调。
 */
export default function PetSelect({
  pets,
  label,
  selectedSlug,
  onSelect,
}: {
  pets: PetListItem[];
  label: string;
  selectedSlug?: string;
  onSelect: (slug: string | undefined) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const selected = pets.find((p) => p.slug === selectedSlug);
  const filtered = useMemo(() => {
    const tq = q.trim();
    if (!tq) return pets.slice(0, 30);
    return pets.filter((p) => p.name.includes(tq)).slice(0, 30);
  }, [q, pets]);

  return (
    <div className="flex-1">
      <label className="mb-1 block text-sm text-muted">{label}</label>
      {selected ? (
        <div className="flex items-center gap-2 rounded-lg border border-input bg-surface p-2">
          <HeadImg pet={selected} />
          <div className="flex-1">
            <div className="font-medium">{selected.name}</div>
            <div className="flex gap-1">
              {selected.types?.map((t) => (
                <span key={t} className="rounded px-1 text-[10px] text-white" style={{ backgroundColor: typeColor(t) }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => onSelect(undefined)} className="text-muted-foreground hover:text-muted">
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="搜索精灵名"
            className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
              {filtered.map((p) => (
                <button
                  key={p.slug}
                  onMouseDown={() => {
                    onSelect(p.slug);
                    setQ("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <HeadImg pet={p} small />
                  <span className="flex-1 text-sm">{p.name}</span>
                  {p.types?.map((t) => (
                    <span key={t} className="rounded px-1 text-[10px] text-white" style={{ backgroundColor: typeColor(t) }}>
                      {t}
                    </span>
                  ))}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HeadImg({ pet, small }: { pet: PetListItem; small?: boolean }) {
  const url = petHeadUrl(pet.headKey);
  const sz = small ? 24 : 36;
  return url ? (
    <ProxyImage src={url} alt={pet.name} width={sz} height={sz} className="object-contain" fallback={<span className="text-lg">🐾</span>} />
  ) : (
    <span className="text-lg">🐾</span>
  );
}
