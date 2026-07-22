/**
 * 前端认证工具（Phase 7）：JWT token 存取 + 登录态判断。
 *
 * token 存 localStorage，客户端发请求时注入 Authorization header。
 * Server Component 调公开读端点不需要 token，只有客户端交互（登录/收藏）才带。
 */

const TOKEN_KEY = "spiritdex_token";
const USER_KEY = "spiritdex_user";

export interface AuthUser {
  userId: number;
  username: string;
  displayName: string;
  role: string;
}

/** 获取 token（仅客户端可用）。 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** 设置 token + 用户信息。 */
export function setAuth(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** 清除认证信息（登出）。 */
export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** 获取当前登录用户（仅客户端，从 localStorage 读缓存）。 */
export function getCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** 是否已登录（仅客户端）。 */
export function isLoggedIn(): boolean {
  return getToken() !== null;
}
