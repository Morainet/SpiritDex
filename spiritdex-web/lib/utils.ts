import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 Tailwind class（处理冲突）+ 条件 class。shadcn/ui 标准助手。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
