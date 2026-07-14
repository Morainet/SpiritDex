import type { PageResult, PetDetail, PetListItem } from "@/types/pet";
import type { SpiritType, TypeMatrix } from "@/types/spiritdex";
import type { ArticleDetail, ArticleListItem } from "@/types/article";
import type { SkillDetail, SkillListItem } from "@/types/skill";
import type { ItemDetail, ItemListItem } from "@/types/item";
import type { QuestDetail, QuestListItem } from "@/types/quest";

export interface ApiResult<T> {
  code: number;
  message: string;
  data?: T;
}

/**
 * Server-side fetch uses BACKEND_URL (.env.local).
 * Client-side fetch uses relative /api/* and relies on next.config.ts rewrites.
 */
function baseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.BACKEND_URL ?? "http://localhost:8080";
  }
  return "";
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  const json: ApiResult<T> = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message || `API error: ${path}`);
  }
  return json.data as T;
}

export interface PetFilter {
  type?: string;
  stage?: number;
  q?: string;
  page?: number;
  size?: number;
}

/** 精灵列表（分页+筛选）。 */
export async function fetchPets(filter: PetFilter = {}): Promise<PageResult<PetListItem>> {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.stage) params.set("stage", String(filter.stage));
  if (filter.q) params.set("q", filter.q);
  params.set("page", String(filter.page ?? 1));
  params.set("size", String(filter.size ?? 24));
  return getJson<PageResult<PetListItem>>(`/api/pets?${params}`);
}

/** 精灵详情（聚合）。不存在返回 null（404）。 */
export async function fetchPetDetail(slug: string): Promise<PetDetail | null> {
  const res = await fetch(`${baseUrl()}/api/pets/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}: /api/pets/${slug}`);
  const json: ApiResult<PetDetail> = await res.json();
  return json.data ?? null;
}

/** 全部属性。 */
export async function fetchTypes(): Promise<SpiritType[]> {
  return getJson<SpiritType[]>("/api/types");
}

/** 属性相克矩阵。 */
export async function fetchTypeMatrix(): Promise<TypeMatrix> {
  return getJson<TypeMatrix>("/api/types/matrix");
}

// ====== 技能库 ======

export interface SkillFilter {
  element?: string;
  category?: string;
  q?: string;
  page?: number;
  size?: number;
}

export async function fetchSkills(filter: SkillFilter = {}): Promise<PageResult<SkillListItem>> {
  const params = new URLSearchParams();
  if (filter.element) params.set("element", filter.element);
  if (filter.category) params.set("category", filter.category);
  if (filter.q) params.set("q", filter.q);
  params.set("page", String(filter.page ?? 1));
  params.set("size", String(filter.size ?? 24));
  return getJson<PageResult<SkillListItem>>(`/api/skills?${params}`);
}

export async function fetchSkillDetail(slug: string): Promise<SkillDetail | null> {
  const res = await fetch(`${baseUrl()}/api/skills/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}: /api/skills/${slug}`);
  const json: ApiResult<SkillDetail> = await res.json();
  return json.data ?? null;
}

// ====== 道具图鉴 ======

export interface ItemFilter {
  mainCategory?: string;
  rarity?: string;
  q?: string;
  page?: number;
  size?: number;
}

export async function fetchItems(filter: ItemFilter = {}): Promise<PageResult<ItemListItem>> {
  const params = new URLSearchParams();
  if (filter.mainCategory) params.set("mainCategory", filter.mainCategory);
  if (filter.rarity) params.set("rarity", filter.rarity);
  if (filter.q) params.set("q", filter.q);
  params.set("page", String(filter.page ?? 1));
  params.set("size", String(filter.size ?? 24));
  return getJson<PageResult<ItemListItem>>(`/api/items?${params}`);
}

export async function fetchItemDetail(slug: string): Promise<ItemDetail | null> {
  const res = await fetch(`${baseUrl()}/api/items/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}: /api/items/${slug}`);
  const json: ApiResult<ItemDetail> = await res.json();
  return json.data ?? null;
}

// ====== 任务图鉴 ======

export interface QuestFilter {
  category?: string;
  q?: string;
  page?: number;
  size?: number;
}

export async function fetchQuests(filter: QuestFilter = {}): Promise<PageResult<QuestListItem>> {
  const params = new URLSearchParams();
  if (filter.category) params.set("category", filter.category);
  if (filter.q) params.set("q", filter.q);
  params.set("page", String(filter.page ?? 1));
  params.set("size", String(filter.size ?? 24));
  return getJson<PageResult<QuestListItem>>(`/api/quests?${params}`);
}

export async function fetchQuestDetail(slug: string): Promise<QuestDetail | null> {
  const res = await fetch(`${baseUrl()}/api/quests/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}: /api/quests/${slug}`);
  const json: ApiResult<QuestDetail> = await res.json();
  return json.data ?? null;
}

// ====== 攻略文章 ======

export async function fetchArticles(category?: string, page = 1, size = 12): Promise<PageResult<ArticleListItem>> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  params.set("page", String(page));
  params.set("size", String(size));
  return getJson<PageResult<ArticleListItem>>(`/api/articles?${params}`);
}

export async function fetchArticleDetail(slug: string): Promise<ArticleDetail | null> {
  const res = await fetch(`${baseUrl()}/api/articles/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}: /api/articles/${slug}`);
  const json: ApiResult<ArticleDetail> = await res.json();
  return json.data ?? null;
}
