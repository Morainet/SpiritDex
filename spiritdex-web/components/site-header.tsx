"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { NAV_GROUPS } from "@/lib/nav-config";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/UserMenu";

export function SiteHeader() {
  const [openMenu, setOpenMenu] = useState<string | null>(null); // 当前打开的菜单名
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // 判断某个 href 是否匹配当前路径（前缀匹配：/pets 命中 /pets/xxx；首页精确匹配避免常亮）
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  // 当前路径命中了哪个分组（用于分组按钮高亮）
  const activeGroup = (groupLabel: string) => {
    const g = NAV_GROUPS.find((x) => x.label === groupLabel);
    return g ? g.items.some((it) => isActive(it.href)) : false;
  };

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
        <Link href="/" className="group mr-4 flex shrink-0 items-center gap-2 text-lg font-bold" onClick={() => setOpenMenu(null)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm sd-transition group-hover:rotate-180">
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
                  openMenu === group.label
                    ? "bg-surface-2 text-foreground"
                    : activeGroup(group.label)
                    ? "text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {group.label}
                <span className={`text-xs opacity-60 transition-transform ${openMenu === group.label ? "rotate-180" : ""}`}>▾</span>
              </button>
              {openMenu === group.label && (
                <div className="absolute left-0 top-full z-[100] mt-1">
                  <div className="animate-slide-down min-w-[180px] origin-top rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-hover)]">
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenMenu(null)}
                          style={{ ["--nav-accent" as string]: item.color }}
                          className={`group/item relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-surface-2 hover:text-foreground ${
                            active ? "text-foreground" : "text-muted"
                          }`}
                        >
                          <span
                            className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--nav-accent)] transition-opacity ${
                              active ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
                            }`}
                          />
                          <item.icon className={`h-4 w-4 transition-colors ${active ? "text-[var(--nav-accent)]" : "group-hover/item:text-[var(--nav-accent)]"}`} />
                          <span className={active ? "font-semibold" : ""}>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu />
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
                <div className="animate-slide-down max-h-[70vh] min-w-[200px] origin-top overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-hover)]">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.label} className="mb-2">
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group.label}</div>
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpenMenu(null)}
                            style={{ ["--nav-accent" as string]: item.color }}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                              active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2"
                            }`}
                          >
                            <item.icon className={`h-4 w-4 ${active ? "text-[var(--nav-accent)]" : ""}`} />
                            <span className={active ? "font-semibold" : ""}>{item.label}</span>
                          </Link>
                        );
                      })}
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
