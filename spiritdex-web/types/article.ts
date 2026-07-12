export interface ArticleListItem {
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  coverImage?: string | null;
  tags?: string[];
  authorName?: string;
  createdAt?: string;
  /** 是否 AI 生成（用于显示「AI」徽章）。 */
  aiGenerated?: boolean;
}

export interface ArticleDetail {
  slug: string;
  title: string;
  summary?: string;
  /** Markdown 正文。 */
  content: string;
  category?: string;
  coverImage?: string | null;
  tags?: string[];
  authorName?: string;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  /** 是否 AI 生成。 */
  aiGenerated?: boolean;
  /** 活动信息来源 URL。 */
  sourceUrl?: string;
}
