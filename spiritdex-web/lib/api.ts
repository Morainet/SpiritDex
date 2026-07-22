import type { PageResult, PetDetail, PetListItem, PetStats } from "@/types/pet";
import type { SpiritType, TypeMatrix } from "@/types/spiritdex";
import type { ArticleDetail, ArticleListItem } from "@/types/article";
import type { SkillDetail, SkillListItem } from "@/types/skill";
import type { ItemDetail, ItemListItem } from "@/types/item";
import type { QuestDetail, QuestListItem } from "@/types/quest";
import type { MarkDetail, MarkListItem } from "@/types/mark";
import type { LocationStat, MapPoint, MapTextLayer, MapTypeStat } from "@/types/map";

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

/** 客户端请求时注入 JWT Authorization header（已登录才有）。 */
function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("spiritdex_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
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
  location?: string;
  q?: string;
  page?: number;
  size?: number;
}

/** 精灵列表（分页+筛选）。 */
export async function fetchPets(filter: PetFilter = {}): Promise<PageResult<PetListItem>> {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.stage) params.set("stage", String(filter.stage));
  if (filter.location) params.set("location", filter.location);
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

// ====== 印记图鉴 ======

export interface MarkFilter {
  faction?: string;
  q?: string;
  page?: number;
  size?: number;
}

export async function fetchMarks(filter: MarkFilter = {}): Promise<PageResult<MarkListItem>> {
  const params = new URLSearchParams();
  if (filter.faction) params.set("faction", filter.faction);
  if (filter.q) params.set("q", filter.q);
  params.set("page", String(filter.page ?? 1));
  params.set("size", String(filter.size ?? 24));
  return getJson<PageResult<MarkListItem>>(`/api/marks?${params}`);
}

export async function fetchMarkDetail(slug: string): Promise<MarkDetail | null> {
  const res = await fetch(`${baseUrl()}/api/marks/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}: /api/marks/${slug}`);
  const json: ApiResult<MarkDetail> = await res.json();
  return json.data ?? null;
}

// ====== 地图点位 ======

export async function fetchMapPoints(type?: number): Promise<MapPoint[]> {
  const params = new URLSearchParams();
  if (type != null) params.set("type", String(type));
  params.set("size", "5000");
  const result = await getJson<PageResult<MapPoint>>(`/api/map/points?${params}`);
  return result.list;
}

export async function fetchMapTypes(): Promise<MapTypeStat[]> {
  return getJson<MapTypeStat[]>("/api/map/types");
}

export async function fetchMapTextLayers(): Promise<MapTextLayer[]> {
  return getJson<MapTextLayer[]>("/api/map/text-layers");
}

// ====== 分布地区 ======

export async function fetchLocations(): Promise<LocationStat[]> {
  return getJson<LocationStat[]>("/api/pets/locations");
}

export async function fetchPetStats(): Promise<PetStats[]> {
  return getJson<PetStats[]>("/api/pets/stats");
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

// ====== 全站搜索 ======

/** 搜索结果分组。 */
export interface SearchResult {
  pets: PetListItem[];
  skills: SkillListItem[];
  items: ItemListItem[];
  quests: QuestListItem[];
  marks: MarkListItem[];
  /** 各组总数（含未展示的）。 */
  totals: { pets: number; skills: number; items: number; quests: number; marks: number };
}

/**
 * 全站搜索：并行调用 5 个图鉴的 search 接口（复用现有 q 参数），
 * 每个板块取前 `limit` 条展示，totals 含完整命中数。
 * 单个板块失败不阻断其他板块。
 */
export async function searchAll(q: string, limit = 8): Promise<SearchResult> {
  const query = q.trim();
  if (!query) {
    return { pets: [], skills: [], items: [], quests: [], marks: [], totals: { pets: 0, skills: 0, items: 0, quests: 0, marks: 0 } };
  }
  const [pets, skills, items, quests, marks] = await Promise.all([
    fetchPets({ q: query, size: limit }).catch(() => ({ list: [] as PetListItem[], total: 0, page: 1, size: limit })),
    fetchSkills({ q: query, size: limit }).catch(() => ({ list: [] as SkillListItem[], total: 0, page: 1, size: limit })),
    fetchItems({ q: query, size: limit }).catch(() => ({ list: [] as ItemListItem[], total: 0, page: 1, size: limit })),
    fetchQuests({ q: query, size: limit }).catch(() => ({ list: [] as QuestListItem[], total: 0, page: 1, size: limit })),
    fetchMarks({ q: query, size: limit }).catch(() => ({ list: [] as MarkListItem[], total: 0, page: 1, size: limit })),
  ]);
  return {
    pets: pets.list,
    skills: skills.list,
    items: items.list,
    quests: quests.list,
    marks: marks.list,
    totals: { pets: pets.total, skills: skills.total, items: items.total, quests: quests.total, marks: marks.total },
  };
}

// ====== 认证（Phase 7）======

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  displayName: string;
  role: string;
}

export async function fetchLogin(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${baseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ username, password }),
  });
  const json: ApiResult<AuthResponse> = await res.json();
  if (json.code !== 0) throw new Error(json.message || "登录失败");
  return json.data as AuthResponse;
}

export async function fetchRegister(
  username: string,
  password: string,
  displayName?: string,
): Promise<AuthResponse> {
  const res = await fetch(`${baseUrl()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ username, password, displayName }),
  });
  const json: ApiResult<AuthResponse> = await res.json();
  if (json.code !== 0) throw new Error(json.message || "注册失败");
  return json.data as AuthResponse;
}

export async function fetchMe(): Promise<AuthResponse | null> {
  const res = await fetch(`${baseUrl()}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (res.status === 401) return null;
  const json: ApiResult<AuthResponse> = await res.json();
  return json.code === 0 ? (json.data as AuthResponse) : null;
}
