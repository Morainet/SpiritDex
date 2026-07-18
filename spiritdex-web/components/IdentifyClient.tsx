"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, ScanLine } from "lucide-react";
import { identifyImage, type IdentifyCandidate } from "@/lib/ai-chat";
import { petIllustrationUrl } from "@/lib/image";
import ProxyImage from "@/components/ProxyImage";

export default function IdentifyClient({ enabled }: { enabled: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [candidates, setCandidates] = useState<IdentifyCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(f: File | null | undefined) {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDesc("");
    setCandidates([]);
    setError("");
  }

  async function submit() {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setDesc("");
    setCandidates([]);
    await identifyImage(
      file,
      (d, c) => {
        setDesc(d);
        setCandidates(c);
      },
      (e) => setError(e)
    );
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {!enabled && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-muted">
          AI 识别暂未启用（未配置 GLM API key）。
        </div>
      )}

      {/* 上传区 */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onPick(e.dataTransfer.files[0]);
        }}
        className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-input bg-surface-2 p-6 text-center transition-colors hover:border-[var(--type-ice)]"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        {preview ? (
          // 用户上传的本地预览，不走代理，用原生 img
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="预览" className="max-h-48 rounded-lg object-contain shadow-sm" />
        ) : (
          <>
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--type-ice)]/15 text-[var(--type-ice)]">
              <Camera className="h-7 w-7" />
            </div>
            <p className="font-medium">点击上传或拖拽精灵截图</p>
            <p className="mt-1 text-xs text-muted-foreground">支持 PNG / JPG，AI 视觉模型识别</p>
          </>
        )}
      </div>

      {/* 提交按钮 */}
      <button
        onClick={submit}
        disabled={!enabled || loading || !file}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--type-ice)] to-[var(--secondary)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? <ScanLine className="h-4 w-4 animate-pulse" /> : <Camera className="h-4 w-4" />}
        {loading ? "AI 识别中…" : "开始识别"}
      </button>

      {/* 错误 */}
      {error && (
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* AI 视觉描述 */}
      {desc && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <ScanLine className="h-4 w-4 text-[var(--type-ice)]" /> AI 视觉描述
          </h2>
          <p className="text-sm leading-relaxed text-muted">{desc}</p>
        </div>
      )}

      {/* 候选精灵：加载骨架 / 结构化卡片 */}
      {loading && !candidates.length && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold text-muted">匹配候选中…</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="ai-skeleton mx-auto mb-2 h-20 w-20 rounded-lg" />
                <div className="ai-skeleton mx-auto mb-1 h-3 w-16" />
                <div className="ai-skeleton mx-auto h-2 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-semibold">候选精灵（按相似度排序）</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {candidates.map((c, i) => (
              <Link
                key={i}
                href={`/pets/${c.slug}`}
                className="group overflow-hidden rounded-xl border border-border transition-all hover:shadow-[var(--shadow-card)]"
              >
                <div className="h-1 bg-[var(--type-ice)]" />
                <div className="flex flex-col items-center p-3">
                  <div className="relative h-20 w-20">
                    <ProxyImage
                      src={petIllustrationUrl(c.illustrationKey)}
                      alt={c.name}
                      fill
                      className="object-contain transition-transform group-hover:scale-110"
                      fallback={<span className="flex h-full w-full items-center justify-center text-3xl opacity-30">🐾</span>}
                    />
                  </div>
                  <span className="mt-1.5 font-medium">{c.name}</span>
                  {/* 相似度进度条 */}
                  <div className="mt-1.5 w-full">
                    <div className="ai-score-bar">
                      <div style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="mt-1 block text-center text-[11px] text-muted-foreground">相似度 {c.score}%</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 无匹配引导 */}
      {!loading && desc && candidates.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface-2 p-4 text-center text-sm text-muted">
          未匹配到候选精灵，可能是图鉴未收录或图片不清晰。
          <Link href="/pets" className="ml-1 text-secondary hover:underline">
            手动浏览图鉴
          </Link>
        </div>
      )}
    </div>
  );
}
