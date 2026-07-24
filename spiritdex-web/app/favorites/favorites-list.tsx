"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PetCard from "@/components/PetCard";
import Pagination from "@/components/Pagination";
import { fetchMyFavorites } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type { PetListItem } from "@/types/pet";

/** 收藏列表（客户端渲染，从 localStorage 带 token 请求）。 */
export function FavoritesList() {
  const router = useRouter();
  const [items, setItems] = useState<PetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetchMyFavorites(page, 24)
      .then((res) => {
        setItems(res.list);
        setTotal(res.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [authed, page]);

  if (!authed && !loading) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">请先登录查看收藏</p>
        <Link
          href="/login"
          className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-6 text-sm text-primary-foreground"
        >
          去登录
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="py-16 text-center text-muted">加载中…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">还没有收藏任何精灵</p>
        <Link
          href="/pets"
          className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-6 text-sm text-primary-foreground"
        >
          去图鉴逛逛
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted">共 {total} 只精灵</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((pet) => (
          <PetCard key={pet.slug} pet={pet} />
        ))}
      </div>
      <Pagination
        page={page}
        size={24}
        total={total}
        basePath="/favorites"
        searchParams={{}}
        unit="只"
      />
    </>
  );
}
