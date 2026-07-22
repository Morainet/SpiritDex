"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchRegister } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("密码至少 6 个字符");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchRegister(username, password, displayName || undefined);
      setAuth(res.token, {
        userId: res.userId, username: res.username,
        displayName: res.displayName, role: res.role,
      });
      router.push("/");
      router.refresh();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted">用户名（3-32 字符）</label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={32}
          autoComplete="username"
          required
          className="h-11"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">密码（至少 6 位）</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          required
          className="h-11"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">昵称（可选）</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={32}
          placeholder="留空则用用户名"
          className="h-11"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "注册中…" : "注册"}
      </button>
      <p className="text-center text-sm text-muted">
        已有账号？{" "}
        <Link href="/login" className="underline hover:text-foreground">登录</Link>
      </p>
    </form>
  );
}
