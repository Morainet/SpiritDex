"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchLogin } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetchLogin(username, password);
      setAuth(res.token, {
        userId: res.userId, username: res.username,
        displayName: res.displayName, role: res.role,
      });
      router.push("/");
      router.refresh();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted">用户名</label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="h-11"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">密码</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="h-11"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "登录中…" : "登录"}
      </button>
      <p className="text-center text-sm text-muted">
        还没有账号？{" "}
        <Link href="/register" className="underline hover:text-foreground">注册</Link>
      </p>
    </form>
  );
}
