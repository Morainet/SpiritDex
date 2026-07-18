import type { ReactNode } from "react";

type Variant = "illusion" | "cute" | "ice";

const VARIANT_COLOR: Record<Variant, string> = {
  illusion: "var(--type-illusion)",
  cute: "var(--type-cute)",
  ice: "var(--type-ice)",
};

/**
 * AI 模块页面标题区（与主站列表页 header 对齐的极简融合式）。
 *
 * <p>设计要点：
 * - 无渐变色块、无边框、无阴影、无圆角、无分割线 —— 和 pets/skills 等列表页 header 同款
 * - 只在图标那个小方块上用属性色（AI 模块的唯一识别色，克制不抢戏）
 * - 标题层级与主站一致（text-2xl font-bold），副标题 text-sm text-muted
 * - 靠下边距与内容分隔（纯留白，无视觉线条）
 */
export default function AiHero({
  variant,
  icon,
  title,
  subtitle,
  children,
}: {
  variant: Variant;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: VARIANT_COLOR[variant] }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
          <p className="text-xs text-muted sm:text-sm">{subtitle}</p>
        </div>
      </div>
      {children}
    </header>
  );
}
