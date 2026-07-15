"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calculator,
  Camera,
  Database,
  FlaskConical,
  Gauge,
  Ghost,
  Map as MapIcon,
  MapPin,
  Menu,
  Package,
  ScrollText,
  Settings2,
  Shield,
  Sparkles,
  Stamp,
  Swords,
  X,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_GROUPS = [
  {
    label: "图鉴",
    items: [
      { href: "/pets", icon: Database, label: "精灵图鉴" },
      { href: "/skills", icon: Zap, label: "技能库" },
      { href: "/items", icon: Package, label: "道具图鉴" },
      { href: "/quests", icon: ScrollText, label: "任务图鉴" },
      { href: "/marks", icon: Stamp, label: "印记图鉴" },
      { href: "/types/matrix", icon: Shield, label: "属性相克" },
      { href: "/map", icon: MapIcon, label: "地图" },
      { href: "/locations", icon: MapPin, label: "分布地区" },
      { href: "/articles?category=机制", icon: FlaskConical, label: "机制知识库" },
      { href: "/articles", icon: BookOpen, label: "攻略" },
    ],
  },
  {
    label: "工具",
    items: [
      { href: "/tools/damage-calculator", icon: Calculator, label: "伤害计算器" },
      { href: "/tools/nature-calculator", icon: Gauge, label: "性格计算器" },
      { href: "/tools/team-builder", icon: Swords, label: "阵容模拟" },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/ai/chat", icon: Ghost, label: "智能问答" },
      { href: "/ai/recommend", icon: Settings2, label: "阵容推荐" },
      { href: "/ai/identify", icon: Camera, label: "图片识别" },
    ],
  },
];

export function SiteHeader() {
  const [openMenu, setOpenMenu] = useState<string | null>(null); // 当前打开的菜单名
  const headerRef = useRef<HTMLElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (name: string) => setOpenMenu((cur) => (cur === name ? null : name));

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-4">
        <Link href="/" className="mr-4 flex shrink-0 items-center gap-2 text-lg font-bold" onClick={() => setOpenMenu(null)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">灵宠档案</span>
        </Link>

        {/* 桌面导航：分组下拉 */}
        <div className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="relative">
              <button
                onClick={() => toggle(group.label)}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  openMenu === group.label ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {group.label}
                <span className={`text-xs opacity-60 transition-transform ${openMenu === group.label ? "rotate-180" : ""}`}>▾</span>
              </button>
              {openMenu === group.label && (
                <div className="absolute left-0 top-full z-[100] mt-1">
                  <div className="min-w-[180px] rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-hover)]">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenMenu(null)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {/* 移动端汉堡菜单 */}
          <div className="relative lg:hidden">
            <button
              onClick={() => toggle("mobile")}
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-2"
            >
              {openMenu === "mobile" ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {openMenu === "mobile" && (
              <div className="absolute right-0 top-full z-[100] mt-1">
                <div className="max-h-[70vh] min-w-[200px] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-hover)]">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.label} className="mb-2">
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group.label}</div>
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenMenu(null)}
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
                        >
                          <item.icon className="h-4 w-4 text-muted" />
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
