import type { ReadonlyURLSearchParams, useRouter } from "next/navigation";

/**
 * 工具页 URL 分享的共用逻辑。
 * 状态序列化到 query string：访问者打开链接即可看到相同配置与结果。
 * 用 router.replace（非 push）回写，避免每次改参数都堆一条历史。
 */

/** 把状态对象写进当前 URL 的 query（空值会被剔除，保持链接干净）。 */
export function syncToUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  currentSearch: string,
  params: Record<string, string | undefined>,
) {
  const sp = new URLSearchParams(currentSearch);
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
    else sp.delete(k);
  }
  const qs = sp.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}

/** 安全读取单个 query 参数。 */
export function readParam(sp: ReadonlyURLSearchParams, key: string): string | undefined {
  const v = sp.get(key);
  return v && v.length > 0 ? v : undefined;
}

/** 复制当前页面完整 URL 到剪贴板，返回是否成功（无 HTTPS / 老浏览器会失败）。 */
export async function copyShareLink(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}
