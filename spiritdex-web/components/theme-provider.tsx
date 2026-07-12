"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** 主题提供者（next-themes）：支持 system/light/dark，class 策略。 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
