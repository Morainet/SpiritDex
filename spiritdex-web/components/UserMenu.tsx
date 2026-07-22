"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User as UserIcon, LogOut } from "lucide-react";
import { clearAuth, getCachedUser, type AuthUser } from "@/lib/auth";

/** 右上角账号入口：未登录显示登录按钮；已登录显示昵称 + 下拉（登出）。 */
export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getCachedUser());
  }, []);

  // 避免 hydration 不匹配（SSR 时无 user，客户端 hydration 后才有）
  if (!mounted) {
    return <div className="h-8 w-16" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-2 px-3 text-sm transition-colors hover:bg-surface-3"
      >
        <UserIcon className="h-4 w-4" />
        登录
      </Link>
    );
  }

  return (
    <div className="group relative">
      <button className="inline-flex h-8 max-w-[120px] items-center gap-1.5 rounded-lg bg-surface-2 px-3 text-sm transition-colors hover:bg-surface-3">
        <UserIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{user.displayName}</span>
      </button>
      {/* 下拉菜单 */}
      <div className="invisible absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-surface py-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
        <div className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
          {user.username}
          {user.role === "ADMIN" && (
            <span className="ml-1 rounded bg-[var(--type-dragon)] px-1 text-[10px] text-white">管理员</span>
          )}
        </div>
        <button
          onClick={() => {
            clearAuth();
            setUser(null);
            router.push("/");
            router.refresh();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
        >
          <LogOut className="h-4 w-4" />
          登出
        </button>
      </div>
    </div>
  );
}
