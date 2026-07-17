/**
 * 精灵/道具图片 URL。
 *
 * <p>统一走后端代理 {@code /api/image-proxy?key=xxx}，而非直连 BWIKI——
 * 浏览器直连 wiki.biligame.com 并发加载时会被 WAF 限流（514/404），大量图片失败。
 * 后端代理带浏览器 UA + Referer 单线程回源，并落本地磁盘缓存，首次预热后秒回。
 */

/**
 * 构造代理 URL。base 为空时走相对路径（由 Next.js rewrites 转发到后端 BACKEND_URL），
 * 生产部署可传完整后端域名。
 */
function proxyUrl(key: string, base = ""): string {
  return `${base}/api/image-proxy?key=${encodeURIComponent(key)}`;
}

/** 头像（小图，用于卡片）。 */
export function petHeadUrl(headKey?: string | null): string | null {
  if (!headKey) return null;
  return proxyUrl(headKey);
}

/** 立绘（大图，用于详情页）。 */
export function petIllustrationUrl(ilKey?: string | null): string | null {
  if (!ilKey) return null;
  return proxyUrl(ilKey);
}

/** 道具图标（icon_id，如 100616）。 */
export function itemIconUrl(iconId?: string | null): string | null {
  if (!iconId) return null;
  return proxyUrl(iconId);
}
