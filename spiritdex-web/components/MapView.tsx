"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/types/map";

// BWIKI 地图配置（与 BWIKI「大地图」页面 MediaWiki:Map4.1.js + window.mapData 同源，S3 赛季）
//
// 关键：BWIKI 瓦片坐标系**原点在地图中心**(非左上角)，瓦片坐标可为负。
// 配合 CRS.Simple + Transformation(1/128) 把游戏坐标(±1500)映射到 Leaflet 像素空间，
// 让 (0,0) 落在瓦片网格中心。
//
// 三个要点(均来自 BWIKI Map4.1.js 源码考证)：
// 1. CRS：CRS.Simple + transformation(0.0078125, 0, 0.0078125, 0)  // 1/128
// 2. 点位：version==4 的数据直接用原始坐标 L.latLng(lat, lng)，不转换
// 3. 瓦片：自定义 TileLayer，用 myBounds + refer 判断瓦片边界，超界返回占位图
const TILE_URL = "https://wiki-dev-patch-oss.oss-cn-hangzhou.aliyuncs.com/res/lkwg/S3/tiles-G/{z}/tile-{x}_{y}.png";
// 超界瓦片的占位图(BWIKI 用一个透明默认图，避免 404)
const TILE_FALLBACK = "https://prod-patch-wiki.biligame.com/res/ys/map/tiles/default.png";
// 各 zoom 的瓦片边界(BWIKI mapData: myBounds = {x1:4, x2:4, y1:4, y2:4})
const TILE_BOUNDS = { x1: 4, x2: 4, y1: 4, y2: 4 };

// 自定义 CRS：CRS.Simple + transformation(1/128)，让游戏坐标(±1500)映射到中心原点的瓦片空间
const WIKI_CRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(0.0078125, 0, 0.0078125, 0),
});

// 自定义 TileLayer：复刻 BWIKI _getTileXY 逻辑
// - 瓦片坐标可为负(原点在中心)
// - 用 refer = ceil(2^(z-1)/2) 配合 myBounds 判断瓦片是否在范围内
// - 超界返回占位图(非 404)，避免底图灰掉
const BwikiTileLayer = (L.TileLayer as any).extend({
  getTileUrl: function (coords: { x: number; y: number; z: number }) {
    const { x, y, z } = coords;
    const url = this._url
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
    // refer = ceil(2^(z-1) / 2)：zoom 每级的瓦片半径基数
    const refer = Math.ceil((1 << (z - 1)) / 2);
    const inBounds =
      -refer * TILE_BOUNDS.x1 <= x &&
      x < refer * TILE_BOUNDS.x2 &&
      -refer * TILE_BOUNDS.y1 <= y &&
      y < refer * TILE_BOUNDS.y2;
    return inBounds ? url : TILE_FALLBACK;
  },
});

const MAP_CONFIG = {
  center: [0, 0] as [number, number],
  zoom: 5,
  minZoom: 4,
  maxZoom: 8,
  maxBounds: L.latLngBounds([-256 * 32, -256 * 60], [256 * 32, 256 * 32]),
};

const WIKI = "https://wiki.biligame.com/rocom";

/** 点位类型配色（无 icon 时用圆点，按 markType 范围配色）。 */
function typeColor(markType: number): string {
  if (markType >= 200 && markType < 300) return "#10b981"; // 设施类 - 绿
  if (markType >= 300 && markType < 400) return "#f59e0b"; // 宝箱类 - 橙
  if (markType >= 400 && markType < 500) return "#3b82f6"; // 任务类 - 蓝
  if (markType >= 800 && markType < 900) return "#ec4899"; // 资源类 - 粉
  if (markType >= 1000) return "#8b5cf6"; // NPC/其他 - 紫
  return "#6b7280"; // 默认灰
}

/** 文字图层（地名标注）。 */
export interface TextLayer {
  text: string;
  lat: number;
  lng: number;
  layer?: string;
  minZoom?: number;
  maxZoom?: number;
}

export default function MapView({
  points,
  textLayers = [],
}: {
  points: MapPoint[];
  textLayers?: TextLayer[];
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const textLayerRef = useRef<L.LayerGroup | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<number>>(() => new Set());
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // 类型列表（去重 + 计数）
  const typeList = useMemo(() => {
    const m = new Map<number, { name: string; count: number }>();
    for (const p of points) {
      const e = m.get(p.markType) ?? { name: p.typeName, count: 0 };
      e.count++;
      m.set(p.markType, e);
    }
    return [...m.entries()].map(([markType, v]) => ({ markType, ...v }));
  }, [points]);

  // 初始化 visibleTypes（全选）
  useEffect(() => {
    setVisibleTypes(new Set(points.map((p) => p.markType)));
  }, [points]);

  // 初始化地图（仅一次）
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      crs: WIKI_CRS,
      ...MAP_CONFIG,
      zoomControl: true,
      attributionControl: false,
    });
    // 自定义瓦片层(中心原点 + 边界判断)，复刻 BWIKI _getTileXY
    new (BwikiTileLayer as any)(TILE_URL, {
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      noWrap: true,
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    textLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // 地图就绪后 fitBounds 到点位分布范围
  // 关键：transformation(1/128) 把游戏坐标(±1500)压到 latLng 空间(±12)，
  // 但瓦片按 zoom 像素排列——视口默认在 [0,0] 周围，看不到分散的点位。
  // fitBounds 让视口自动覆盖所有点位，点位和底图就同框显示了。
  useEffect(() => {
    if (!mapReady || !mapRef.current || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40] });
  }, [mapReady, points]);

  // 渲染点位 marker（visibleTypes 变化时更新）
  useEffect(() => {
    if (!mapReady || !markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();

    for (const p of points) {
      if (!visibleTypes.has(p.markType)) continue;
      const latlng = L.latLng(p.lat, p.lng);

      // 有 icon 用图片 marker，否则用彩色圆点
      let marker: L.Marker;
      if (p.icon) {
        const icon = L.divIcon({
          className: "map-point-icon",
          html: `<img src="${WIKI}/Special:FilePath/${p.icon}" style="width:24px;height:24px;object-fit:contain;" onerror="this.style.display='none'"/>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        marker = L.marker(latlng, { icon });
      } else {
        const color = typeColor(p.markType);
        const icon = L.divIcon({
          className: "map-point-dot",
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:1.5px solid white;box-shadow:0 0 2px rgba(0,0,0,0.5);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        marker = L.marker(latlng, { icon });
      }

      const popupHtml = `<div style="min-width:120px"><strong>${p.title || p.typeName}</strong>${p.description ? `<br/><span style="font-size:12px;color:#666">${p.description}</span>` : ""}<br/><span style="font-size:11px;color:#999">${p.typeName}</span></div>`;
      marker.bindPopup(popupHtml);
      marker.on("click", () => setSelected(p));
      markerLayerRef.current.addLayer(marker);
    }
  }, [mapReady, points, visibleTypes]);

  // 渲染文字图层（地名标注，随 zoom 级别显隐）
  useEffect(() => {
    if (!mapReady || !textLayerRef.current || !mapRef.current) return;
    textLayerRef.current.clearLayers();

    for (const t of textLayers) {
      const marker = L.marker(L.latLng(t.lat, t.lng), {
        icon: L.divIcon({
          className: "map-text-label",
          html: `<span style="font-size:13px;font-weight:600;color:#1a1a1a;text-shadow:0 0 3px white,0 0 3px white,0 0 3px white;padding:1px 4px;white-space:nowrap;">${t.text}</span>`,
          iconSize: [0, 0],
        }),
        interactive: false,
      });
      textLayerRef.current.addLayer(marker);
    }
  }, [mapReady, textLayers]);

  function toggleType(t: number) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
      {/* 地图 */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-3 py-2 text-sm text-muted">
          底图与点位数据来自 BWIKI 社区 · 游戏内坐标系 · 拖拽平移 / 滚轮缩放
        </div>
        {/* Leaflet 容器：固定高度 */}
        <div ref={mapContainerRef} style={{ height: "600px", width: "100%" }} />
      </div>

      {/* 右侧：类型筛选 + 选中详情 */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">点位类型</h3>
            <span className="text-xs text-muted-foreground">{typeList.length} 种</span>
          </div>
          <div className="max-h-96 space-y-1 overflow-auto">
            {typeList.map((t) => (
              <button
                key={t.markType}
                onClick={() => toggleType(t.markType)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors ${
                  visibleTypes.has(t.markType) ? "bg-surface-2" : "opacity-40"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: typeColor(t.markType) }}
                />
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-muted-foreground">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1 border-t border-border pt-2">
            <button
              onClick={() => setVisibleTypes(new Set(points.map((p) => p.markType)))}
              className="flex-1 rounded bg-surface-2 px-2 py-1 text-xs hover:opacity-80"
            >
              全选
            </button>
            <button
              onClick={() => setVisibleTypes(new Set())}
              className="flex-1 rounded bg-surface-2 px-2 py-1 text-xs hover:opacity-80"
            >
              全不选
            </button>
          </div>
        </div>

        {selected && (
          <div className="rounded-xl border border-border bg-surface p-3">
            <h3 className="mb-1 text-sm font-semibold">{selected.title || selected.typeName}</h3>
            <p className="text-xs text-muted">
              <span className="rounded px-1" style={{ backgroundColor: typeColor(selected.markType), color: "white" }}>
                {selected.typeName}
              </span>
            </p>
            {selected.description && <p className="mt-2 text-sm text-muted">{selected.description}</p>}
            <p className="mt-2 font-mono text-xs text-muted-foreground">({selected.lat.toFixed(1)}, {selected.lng.toFixed(1)})</p>
          </div>
        )}
      </div>
    </div>
  );
}
