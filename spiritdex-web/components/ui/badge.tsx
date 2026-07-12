import * as React from "react";
import { cn } from "@/lib/utils";

/** 属性徽章/通用标签：圆角、小字、彩色背景。 */
export function Badge({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium leading-none",
        className
      )}
      style={style}
      {...props}
    />
  );
}
