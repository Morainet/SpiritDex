/** 精灵列表项（精简）。 */
export interface PetListItem {
  slug: string;
  dexNo: number;
  name: string;
  title?: string;
  stage?: number;
  /** 属性中文名，如 ["草"] 或 ["草","武"]。 */
  types?: string[];
  illustrationKey?: string | null;
  headKey?: string | null;
}

/** 精灵详情（聚合属性/技能/进化链）。 */
export interface PetDetail {
  slug: string;
  dexNo: number;
  name: string;
  title?: string;
  description?: string;
  category?: string;
  stage?: number;
  types?: string[];
  /** 种族值 {hp,atk,def,spa,sdf,spe}。 */
  baseStats?: Record<string, number>;
  height?: string;
  weight?: string;
  canDoubleRide?: boolean;
  hasShiny?: boolean;
  habitat?: string;
  illustrationKey?: string | null;
  headKey?: string | null;
  evolutionGroupId?: string;
  skills?: PetSkill[];
  evolution?: EvolutionChain | null;
}

export interface PetSkill {
  slug: string;
  name: string;
  category?: string;
  element?: string;
  power?: number | null;
  damageClass?: string;
  energy?: number | null;
  target?: string;
  effectText?: string;
  learnMethod?: string;
  unlockLevel?: number | null;
}

export interface EvolutionChain {
  groupId: string;
  name?: string;
  stages: EvolutionStageInfo[];
}

export interface EvolutionStageInfo {
  stageNo: number;
  level?: number | null;
  petSlug?: string;
  petName?: string;
  illustrationKey?: string | null;
  types?: string[];
}

/** 后端统一分页响应。 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}
