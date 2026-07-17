import Link from "next/link";
import type { PetListItem } from "@/types/pet";
import { petHeadUrl } from "@/lib/image";
import { typeColor } from "@/lib/type-colors";
import ProxyImage from "@/components/ProxyImage";

const STAGE_LABEL: Record<number, string> = { 1: "一阶", 2: "二阶", 3: "三阶" };

export default function PetCard({ pet }: { pet: PetListItem }) {
  const headUrl = petHeadUrl(pet.headKey);
  const primaryColor = pet.types?.[0] ? typeColor(pet.types[0]) : "var(--muted)";

  return (
    <Link
      href={`/pets/${pet.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-hover)] hover:-translate-y-0.5"
    >
      {/* 属性色顶条 */}
      <div className="h-1" style={{ backgroundColor: primaryColor }} />

      <div className="relative flex h-32 items-center justify-center bg-surface-2">
        {headUrl ? (
          <ProxyImage
            src={headUrl}
            alt={pet.name}
            width={96}
            height={96}
            className="object-contain transition-transform duration-200 group-hover:scale-110"
            fallback={<span className="text-4xl opacity-30">🐾</span>}
          />
        ) : (
          <span className="text-4xl opacity-30">🐾</span>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-muted backdrop-blur">
          No.{String(pet.dexNo).padStart(4, "0")}
        </span>
        {pet.stage && (
          <span
            className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {STAGE_LABEL[pet.stage] ?? `${pet.stage}阶`}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <span className="font-semibold leading-tight">{pet.name}</span>
        {pet.types && pet.types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pet.types.map((t) => (
              <span
                key={t}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: typeColor(t) }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
