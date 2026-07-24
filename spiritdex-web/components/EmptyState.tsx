import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { SearchX, ServerOff } from "lucide-react";

/**
 * 统一空状态组件。
 *
 * <p>替代原先各列表页里一句灰字 {@code py-16 text-center text-muted} 的简陋空状态。
 * 区分两种语义:
 * <ul>
 *   <li>{@code variant="empty"}(默认):无搜索结果,引导用户清除筛选。</li>
 *   <li>{@code variant="error"}:后端不可用 / 数据加载失败,提示稍后重试。</li>
 * </ul>
 *
 * @param icon 自定义图标(默认按 variant 选)
 * @param title 自定义主文案
 * @param description 自定义副文案
 * @param action 操作按钮(传 {href,label} 渲染为 Link)
 */
export function EmptyState({
  variant = "empty",
  icon,
  title,
  description,
  action,
}: {
  variant?: "empty" | "error";
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  const Icon = icon ?? (variant === "error" ? ServerOff : SearchX);
  const defaultTitle = variant === "error" ? "数据加载失败" : "没有找到结果";
  const defaultDesc =
    variant === "error"
      ? "服务暂时不可用,请稍后刷新重试"
      : "试试调整筛选条件或换个关键词";

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground">
        <Icon className="h-7 w-7" />
      </span>
      <div>
        <p className="text-base font-medium text-foreground">{title ?? defaultTitle}</p>
        <p className="mt-1 text-sm text-muted">{description ?? defaultDesc}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="mt-1 inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm transition-colors hover:bg-surface-2"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
