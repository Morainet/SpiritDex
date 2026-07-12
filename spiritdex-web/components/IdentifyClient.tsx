"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { identifyImage, type IdentifyCandidate } from "@/lib/ai-chat";
import { petIllustrationUrl } from "@/lib/image";

export default function IdentifyClient({ enabled }: { enabled: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState("");
  const [candidates, setCandidates] = useState<IdentifyCandidate[]>([]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(f: File | null) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDesc("");
    setCandidates([]);
    setError("");
  }

  async function submit() {
    if (!file) {
      setError("请先选择图片");
      return;
    }
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
      (err) => setError(err)
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
        className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-input bg-surface-2 p-6 text-center hover:border-border"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="预览" className="max-h-48 object-contain" />
        ) : (
          <>
            <span className="mb-2 text-4xl">📷</span>
            <p className="text-sm text-muted">点击或拖拽上传精灵截图</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG / PNG / WebP，≤5MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </div>

      <button
        onClick={submit}
        disabled={!enabled || loading || !file}
        className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "AI 识别中…" : "开始识别"}
      </button>

      {error && <div className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] p-3 text-sm text-[var(--danger)]">{error}</div>}

      {/* VLM 描述 */}
      {desc && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-muted">AI 视觉描述</h2>
          <p className="text-sm text-muted">{desc}</p>
        </div>
      )}

      {/* 候选精灵 */}
      {candidates.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted">候选精灵（按相似度排序）</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {candidates.map((c) => {
              const url = petIllustrationUrl(c.illustrationKey);
              return (
                <Link
                  key={c.slug}
                  href={`/pets/${c.slug}`}
                  className="flex flex-col items-center rounded-lg border border-border p-3 text-center hover:bg-surface-2"
                >
                  <div className="relative h-20 w-20">
                    {url ? (
                      <Image src={url} alt={c.name} fill unoptimized className="object-contain" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-3xl">🐾</span>
                    )}
                  </div>
                  <span className="mt-1 text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">相似度 {c.score}%</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {desc && candidates.length === 0 && !loading && (
        <div className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted-foreground">
          未能匹配到候选精灵，请到
          <Link href="/pets" className="text-secondary hover:underline"> 精灵图鉴 </Link>
          手动查找
        </div>
      )}
    </div>
  );
}
