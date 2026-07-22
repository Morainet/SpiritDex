/** 地图点位（游戏内坐标系，与 BWIKI 大地图同源）。 */
export interface MapPoint {
  id?: number;
  markType: number;
  typeName: string;
  /** icon 文件名（如 地图_点位_icon_庇护所.png），前端拼 Special:FilePath。 */
  icon?: string | null;
  title?: string;
  description?: string;
  lat: number;
  lng: number;
  layer?: string;
}

/** 文字图层（地名标注）。 */
export interface MapTextLayer {
  text: string;
  lat: number;
  lng: number;
  layer?: string;
  minZoom?: number;
  maxZoom?: number;
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
