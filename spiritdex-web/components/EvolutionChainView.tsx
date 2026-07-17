import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { EvolutionChain } from "@/types/pet";
import { petIllustrationUrl } from "@/lib/image";
import { typeColor } from "@/lib/type-colors";
import ProxyImage from "@/components/ProxyImage";

/** 进化链横向流程图：stage1 →(Lv) stage2 →(Lv) stage3。 */
export default function EvolutionChainView({ chain }: { chain?: EvolutionChain | null }) {
  if (!chain || chain.stages.length === 0) return null;
  const stages = [...chain.stages].sort((a, b) => a.stageNo - b.stageNo);

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">进化链</h2>
      <div className="flex flex-wrap items-center gap-2">
        {stages.map((st, i) => (
          <div key={st.stageNo} className="flex items-center gap-2">
            {i > 0 && (
              <div className="flex flex-col items-center px-1 text-xs text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                {st.level ? <span>Lv.{st.level}</span> : <span>进化</span>}
              </div>
            )}
            <StageCard stage={st} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StageCard({ stage }: { stage: EvolutionChain["stages"][number] }) {
  const url = petIllustrationUrl(stage.illustrationKey);
  const inner = (
    <div className="flex w-28 flex-col items-center rounded-xl border border-border bg-surface p-2 text-center shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-hover)]">
      <div className="relative h-20 w-20">
        {url ? (
          <ProxyImage src={url} alt={stage.petName ?? ""} fill className="object-contain" fallback={<span className="flex h-full w-full items-center justify-center text-3xl opacity-20">🐾</span>} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl opacity-20">🐾</span>
        )}
      </div>
      <span className="mt-1 text-sm font-medium leading-tight">{stage.petName}</span>
      {stage.types && stage.types.length > 0 && (
        <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
          {stage.types.map((t) => (
            <span key={t} className="rounded px-1 text-[10px] font-medium text-white" style={{ backgroundColor: typeColor(t) }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
  return stage.petSlug ? <Link href={`/pets/${stage.petSlug}`}>{inner}</Link> : inner;
}
