export interface ArticleListItem {
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  coverImage?: string | null;
  tags?: string[];
  authorName?: string;
  createdAt?: string;
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
}
