import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "灵宠档案 | 洛克王国手游攻略站", template: "%s | 灵宠档案" },
  description: "洛克王国手游精灵图鉴、属性相克、攻略工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <SiteHeader />
          {children}
          <footer className="mt-auto border-t border-border bg-surface">
            <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-muted-foreground">
              <p>灵宠档案 · 非官方攻略站，数据仅供参考 · 数据来源：BWIKI</p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
