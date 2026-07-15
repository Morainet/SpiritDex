import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { fetchPetDetail, fetchPets } from "@/lib/api";
import { petIllustrationUrl } from "@/lib/image";
import { typeColor } from "@/lib/type-colors";
import type { PetSkill } from "@/types/pet";
import StatsRadar from "@/components/StatsRadar";
import EvolutionChainView from "@/components/EvolutionChainView";

export const dynamicParams = false;

export async function generateStaticParams() {
  const result = await fetchPets({ size: 1000 });
  return result.list.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pet = await fetchPetDetail(slug);
  if (!pet) return { title: "精灵不存在" };
  return { title: `${pet.name}${pet.title ? `·${pet.title}` : ""}`, description: pet.description?.slice(0, 80) };
}

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pet = await fetchPetDetail(slug);
  if (!pet) notFound();

  const illustration = petIllustrationUrl(pet.illustrationKey);
  const dex = String(pet.dexNo).padStart(4, "0");
  const jsonLd = { "@context": "https://schema.org", "@type": "VideoGame", name: `洛克王国手游 · ${pet.name}`, description: pet.description };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 返回 */}
      <Link href="/pets" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回图鉴
      </Link>

      {/* 头部 */}
      <div className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <h1 className="text-3xl font-bold">{pet.name}</h1>
          <span className="font-mono text-sm text-muted-foreground">No.{dex}</span>
          {pet.title && pet.title !== pet.name && <span className="text-sm text-muted">「{pet.title}」</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {pet.types?.map((t) => (
            <span key={t} className="rounded-md px-2 py-0.5 text-sm font-medium text-white" style={{ backgroundColor: typeColor(t) }}>
              {t}系
            </span>
          ))}
          {pet.category && <span className="text-sm text-muted">{pet.category}</span>}
          {pet.stage && <span className="text-sm text-muted">{pet.stage}阶形态</span>}
          <a
            href={`/ai/chat?q=${encodeURIComponent(`${pet.name}怎么培养？`)}`}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--type-dragon)] to-[var(--type-illusion)] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Bot className="h-4 w-4" /> 问 AI
          </a>
        </div>
      </div>

      {/* 主体：左立绘 / 右种族值 */}
      <div className="mb-6 grid gap-6 md:grid-cols-[360px_1fr]">
        <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-2">
          {illustration ? (
            <Image src={illustration} alt={pet.name} width={340} height={340} unoptimized className="object-contain" />
          ) : (
            <span className="text-6xl opacity-20">🐾</span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <StatsRadar baseStats={pet.baseStats} />
            <div className="flex-1">
              <h2 className="mb-2 text-sm font-semibold text-muted">种族值</h2>
              <StatBars baseStats={pet.baseStats} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {pet.height && (<div><dt className="text-muted-foreground">身高</dt><dd>{pet.height}</dd></div>)}
            {pet.weight && (<div><dt className="text-muted-foreground">体重</dt><dd>{pet.weight}</dd></div>)}
            {pet.habitat && (<div><dt className="text-muted-foreground">栖息地</dt><dd>{pet.habitat}</dd></div>)}
            {pet.hasShiny !== undefined && (<div><dt className="text-muted-foreground">异色</dt><dd>{pet.hasShiny ? "有" : "无"}</dd></div>)}
          </dl>

          {pet.description && (
            <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{pet.description}</p>
          )}

          {pet.locations && pet.locations.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">分布地区</h2>
              <div className="flex flex-wrap gap-1.5">
                {pet.locations.map((loc) => (
                  <Link
                    key={loc}
                    href={`/pets?location=${encodeURIComponent(loc)}`}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs transition-colors hover:bg-surface-2"
                  >
                    {loc}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 进化链 */}
      <div className="mb-6">
        <EvolutionChainView chain={pet.evolution} />
      </div>

      {/* 技能 */}
      <section>
        <h2 className="mb-3 text-lg font-bold">技能</h2>
        {pet.skills && pet.skills.length > 0 ? (
          <SkillTable skills={pet.skills} />
        ) : (
          <p className="text-sm text-muted">暂无技能数据</p>
        )}
      </section>
    </main>
  );
}

function StatBars({ baseStats }: { baseStats?: Record<string, number> }) {
  if (!baseStats) return null;
  const items: { key: string; label: string }[] = [
    { key: "hp", label: "体力" }, { key: "atk", label: "物攻" }, { key: "def", label: "物防" },
    { key: "spa", label: "魔攻" }, { key: "sdf", label: "魔防" }, { key: "spe", label: "速度" },
  ];
  return (
    <div className="space-y-1">
      {items.map((it) => {
        const v = Number(baseStats[it.key] ?? 0);
        return (
          <div key={it.key} className="flex items-center gap-2 text-xs">
            <span className="w-10 text-muted">{it.label}</span>
            <span className="w-8 text-right font-mono">{v}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, (v / 160) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SkillTable({ skills }: { skills: PetSkill[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-muted">
            <th className="py-2 pr-3">技能</th>
            <th className="px-3">类别</th>
            <th className="px-3">属性</th>
            <th className="px-3">威力</th>
            <th className="px-3">能耗</th>
            <th className="px-3">学习方式</th>
            <th className="py-2 pl-3">效果</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.slug} className="border-b border-border align-top last:border-0">
              <td className="py-2 pr-3 font-medium">{s.name}</td>
              <td className="px-3 text-muted">{s.category ?? "—"}</td>
              <td className="px-3">
                {s.element ? <span className="rounded px-1.5 py-0.5 text-xs text-white" style={{ backgroundColor: typeColor(s.element) }}>{s.element}</span> : "—"}
              </td>
              <td className="px-3 font-mono text-muted">{s.power ?? "—"}</td>
              <td className="px-3 font-mono text-muted">{s.energy ?? "—"}</td>
              <td className="px-3 text-xs text-muted">{learnMethodLabel(s.learnMethod)}</td>
              <td className="py-2 pl-3 text-muted">{s.effectText ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function learnMethodLabel(m?: string): string {
  switch (m) {
    case "feature": return "特性";
    case "native": return "自然学习";
    case "stone": return "技能石";
    case "blood": return "血脉";
    default: return m ?? "—";
  }
}
