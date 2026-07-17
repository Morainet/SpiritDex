"use client";

import Image from "next/image";
import { useState } from "react";
import { Package } from "lucide-react";

type Props = {
  src: string | null | undefined;
  alt: string;
  /** 两种尺寸模式：fill（填充父容器，需父容器 relative）或固定宽高。 */
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  /** 自定义占位内容（图标/emoji/节点）。默认用 Package 图标。 */
  fallback?: React.ReactNode;
};

/**
 * 统一的图片代理渲染组件，封装 next/image + 加载失败占位。
 *
 * <p>约 10% 的精灵/道具图片在 BWIKI 上不存在（代理返回 404）。
 * 原直接用 next/image 会显示破图；本组件在 onError 时切换为占位内容，
 * 保持卡片布局不塌陷。
 */
export default function ProxyImage({
  src,
  alt,
  fill = false,
  width,
  height,
  className,
  fallback,
}: Props) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <>
        {fallback ? fallback : <Package className="h-8 w-8 text-muted-foreground" aria-label={alt} />}
      </>
    );
  }

  const common = {
    unoptimized: true,
    onError: () => setErrored(true),
    className,
  } as const;

  if (fill) {
    return <Image {...common} src={src} alt={alt} fill />;
  }
  return <Image {...common} src={src} alt={alt} width={width ?? 48} height={height ?? 48} />;
}
