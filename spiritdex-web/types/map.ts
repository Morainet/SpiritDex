/** 地图点位（游戏内坐标系）。 */
export interface MapPoint {
  id?: number;
  markType: number;
  typeName: string;
  title?: string;
  description?: string;
  lat: number;
  lng: number;
}

/** 点位类型聚合统计。 */
export interface MapTypeStat {
  markType: number;
  typeName: string;
  count: number;
}

/** 分布地区聚合（每个地名有多少精灵）。 */
export interface LocationStat {
  location: string;
  cnt: number;
}
