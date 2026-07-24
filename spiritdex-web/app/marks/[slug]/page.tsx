import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { fetchMarkDetail } from "@/lib/api";
import { MARK_FACTION_COLOR } from "@/lib/badge-styles";

/** 清理 wiki 标记：[[a|b]]→b、[[a]]→a、'''x'''→x、**x**→x。 */
function stripWiki(text: string): string {
  return text
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/'''([^']+)'''/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1");
}

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mark = await fetchMarkDetail(slug);
  if (!mark) return { title: "印记不存在" };
  return { title: `印记·${mark.name}`, description: mark.effectText?.slice(0, 80) };
}

export default async function MarkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mark = await fetchMarkDetail(slug);
  if (!mark) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/marks" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> 返回印记图鉴
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold">{mark.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {mark.faction && (
            <span
              className="rounded-md px-2 py-0.5 text-sm font-medium text-white"
              style={{ backgroundColor: MARK_FACTION_COLOR[mark.faction] ?? "var(--secondary)" }}
            >
              {mark.faction}印记
            </span>
          )}
        </div>
      </header>

      {mark.effectText && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">基础效果</h2>
          <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{mark.effectText}</p>
        </section>
      )}

      {mark.mechanics && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">机制说明</h2>
          <div className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">
            {stripWiki(mark.mechanics).split("\n").map((line, i) => (
              <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>
            ))}
          </div>
        </section>
      )}

      {mark.sourceSkills && mark.sourceSkills.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">可施加该印记的技能</h2>
          <div className="flex flex-col gap-2">
            {mark.sourceSkills.map((sk, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface px-3 py-2">
                <span className="font-medium">{sk.name}</span>
                {sk.desc && <span className="ml-2 text-sm text-muted-foreground">{stripWiki(sk.desc)}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {mark.sourceUrl && (
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          数据来源：
          <a href={mark.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline hover:text-foreground">
            BWIKI <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </main>
  );
}
