import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchSkillDetail, fetchSkills } from "@/lib/api";
import { typeColor } from "@/lib/type-colors";

export const dynamicParams = false;

export async function generateStaticParams() {
  const result = await fetchSkills({ size: 1000 });
  return result.list.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const skill = await fetchSkillDetail(slug);
  if (!skill) return { title: "技能不存在" };
  return { title: `技能·${skill.name}`, description: skill.effectText?.slice(0, 80) };
}

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skill = await fetchSkillDetail(slug);
  if (!skill) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/skills" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回技能库
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold">{skill.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {skill.element && <span className="rounded-md px-2 py-0.5 text-sm font-medium text-white" style={{ backgroundColor: typeColor(skill.element) }}>{skill.element}系</span>}
          {skill.category && <span className="text-sm text-muted">{skill.category}</span>}
          {skill.damageClass && <span className="text-sm text-muted">{skill.damageClass}</span>}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Param label="威力" value={skill.power} />
        <Param label="能耗" value={skill.energy} />
        <Param label="目标" value={skill.target} />
        <Param label="类别" value={skill.category} />
      </section>

      {skill.effectText && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">技能效果</h2>
          <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{skill.effectText}</p>
        </section>
      )}

      {skill.flavorText && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">趣闻</h2>
          <p className="text-sm italic text-muted">{skill.flavorText}</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">可学精灵</h2>
        {skill.pets && skill.pets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {skill.pets.map((p) => (
              <Link key={p.slug} href={`/pets/${p.slug}`} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">
                {p.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
            暂无可学精灵数据。
          </p>
        )}
      </section>
    </main>
  );
}

function Param({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center shadow-[var(--shadow-card)]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value ?? "—"}</div>
    </div>
  );
}
