import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeContextProvider } from "@/components/theme-context";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "灵宠档案 | 洛克王国手游攻略站", template: "%s | 灵宠档案" },
  description: "洛克王国手游精灵图鉴、属性相克、攻略工具",
};

/**
 * 防主题闪烁脚本（FOUC prevention）。
 *
 * <p>用 {@code next/script} 的 {@code beforeInteractive} 策略注入：Next.js 把它
 * 序列化进 HTML 流的早期位置，浏览器解析到立即执行（早于 React hydration），
 * 避免首屏白闪/黑闪。{@code next/script} 由 Next 的 ScriptLoader 用 data-nscript
 * 机制管理，不经过 React 的 {@code <script>} 元素 reconciler，从而规避 React 19 /
 * Next 16 的 "Encountered a script tag while rendering React component" 警告
 * （直接用 {@code <script dangerouslySetInnerHTML>} 仍会触发该警告）。
 *
 * <p>逻辑与 theme-context.tsx 的 applyClass 保持一致：读 localStorage 的
 * "spiritdex-theme"，"system" 时按 prefers-color-scheme 解析，切换 {@code <html>.dark}。
 */
const themeScript = `(function(){try{var k='spiritdex-theme';var s=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=(s==='dark')||(s!=='light'&&s&&d)||(!s&&d)||((s==='system'||!s)&&d);var el=document.documentElement;if(r){el.classList.add('dark')}else{el.classList.remove('dark')}el.style.colorScheme=r?'dark':'light'}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeContextProvider>
          <SiteHeader />
          {children}
          <footer className="mt-auto border-t border-border bg-surface">
            <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-muted-foreground">
              <p>灵宠档案 · 非官方攻略站，数据仅供参考 · 数据来源：BWIKI</p>
            </div>
          </footer>
        </ThemeContextProvider>
      </body>
    </html>
  );
}
