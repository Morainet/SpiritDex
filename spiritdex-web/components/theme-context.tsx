"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * 自研轻量主题系统（替代 next-themes）。
 *
 * <p>设计要点：
 * <ul>
 *   <li>不渲染任何 {@code <script>}：防 FOUC（主题闪烁）脚本放在 {@code app/layout.tsx}
 *       这个 <b>Server Component</b> 里作为原生 script，由 SSR 直接序列化进 HTML，
 *       不经过 React 客户端 reconciler，从而规避 React 19 / Next 16 的
 *       "Encountered a script tag while rendering React component" 警告。</li>
 *   <li>本 Context 只负责 JS 逻辑：读写 localStorage、监听系统配色、切换 {@code <html>} 的 class。</li>
 *   <li>API 与 next-themes 的 {@code useTheme()} 对齐：{@code theme} / {@code setTheme}。</li>
 * </ul>
 */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "spiritdex-theme";

interface ThemeContextValue {
  /** 用户选择的主题（可能是 "system"，表示跟随系统）。 */
  theme: Theme;
  /** 实际生效的主题（"system" 已解析成 "light"/"dark"）。 */
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** 把主题作用到 <html> 的 class（与防闪烁脚本保持一致的 class 策略）。 */
function applyClass(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  // 初始用 "system" 占位，避免 SSR/首屏不一致；挂载后立即读 localStorage 对齐。
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // 挂载：读 localStorage，应用一次。
  useEffect(() => {
    const t = readStored();
    const resolved: "light" | "dark" = t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
    setThemeState(t);
    setResolvedTheme(resolved);
    applyClass(resolved);
  }, []);

  // 监听系统配色变化：仅当用户选 "system" 时才联动。
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setThemeState((cur) => {
        if (cur !== "system") return cur;
        const resolved = mq.matches ? "dark" : "light";
        setResolvedTheme(resolved);
        applyClass(resolved);
        return cur;
      });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // 无痕模式或容量受限，静默放弃
    }
    const resolved: "light" | "dark" = t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
    setResolvedTheme(resolved);
    applyClass(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** 主题钩子（API 与 next-themes 对齐）。未在 Provider 内时返回安全默认值。 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  return ctx ?? { theme: "system", resolvedTheme: "light", setTheme: () => {} };
}
