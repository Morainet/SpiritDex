import type { Metadata } from "next";
import Link from "next/link";
import { FavoritesList } from "./favorites-list";

export const metadata: Metadata = {
  title: "我的收藏",
};

export default function FavoritesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">我的收藏</h1>
        <p className="text-sm text-muted">收藏的精灵会显示在这里</p>
      </header>
      <FavoritesList />
    </main>
  );
}
