"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { addFavorite, fetchFavoriteCheck, removeFavorite } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

/** 收藏按钮：显示收藏状态，点击切换。未登录跳登录页。 */
export function FavoriteButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  // 初始检查收藏状态（已登录才查）
  useEffect(() => {
    if (!isLoggedIn()) return;
    fetchFavoriteCheck(slug).then(setFavorited).catch(() => {});
  }, [slug]);

  async function handleClick() {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      if (favorited) {
        await removeFavorite(slug);
        setFavorited(false);
      } else {
        await addFavorite(slug);
        setFavorited(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
        favorited
          ? "bg-[color-mix(in_srgb,var(--favorite)_12%,transparent)] text-[var(--favorite)] hover:bg-[color-mix(in_srgb,var(--favorite)_20%,transparent)]"
          : "bg-surface-2 text-muted hover:bg-surface-3"
      }`}
    >
      <Heart
        key={favorited ? "on" : "off"}
        className={`h-4 w-4 ${favorited ? "fill-current animate-[sd-heart-pop_0.4s_ease-out]" : ""}`}
      />
      {favorited ? "已收藏" : "收藏"}
    </button>
  );
}
