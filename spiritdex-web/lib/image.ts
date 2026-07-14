/**
 * BWIKI 图片外链拼接（合规：不下载到自家服务器，注明出处）。
 * Special:FilePath 会 302 到 patchwiki.biligame.com CDN，next.config 已加白名单。
 */

const WIKI = "https://wiki.biligame.com/rocom";

/** 头像（小图，用于卡片）。 */
export function petHeadUrl(headKey?: string | null): string | null {
  if (!headKey) return null;
  return `${WIKI}/Special:FilePath/${headKey}.png`;
}

/** 立绘（大图，用于详情页）。 */
export function petIllustrationUrl(ilKey?: string | null): string | null {
  if (!ilKey) return null;
  return `${WIKI}/Special:FilePath/${ilKey}.png`;
}

/** 道具图标（icon_id，如 100616）。 */
export function itemIconUrl(iconId?: string | null): string | null {
  if (!iconId) return null;
  return `${WIKI}/Special:FilePath/${iconId}.png`;
}
