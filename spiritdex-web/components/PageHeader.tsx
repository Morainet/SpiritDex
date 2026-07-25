import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 统一页面标题区(收敛原先散落的三套页头样式)。
 *
 * <p>结构:[返回链接] / [标题 + 副标题] + [右侧操作区]。
 * 来自 UI 架构重设计方案 §4.2。
 *
 * @param title 主标题
 * @param subtitle 副标题/统计数据(可选)
 * @param back 返回链接 {href,label}(可选)
 * @param actions 右侧操作区(筛选/收藏等,可选)
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted sd-transition hover:text-foreground"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
