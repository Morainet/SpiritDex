"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/types/map";

// BWIKI 地图配置（与 BWIKI「大地图」同源）
const TILE_URL = "https://wiki-dev-patch-oss.oss-cn-hangzhou.aliyuncs.com/res/lkwg/map-3.0/{z}/tile-{x}_{y}.png";
const MAP_CONFIG = {
  center: [0, 0] as [number, number],
  zoom: 5,
  minZoom: 4,
  maxZoom: 8,
  // maxBounds（BWIKI 配置：[-256*32,-256*60]~[256*32,256*32]）
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
      crs: L.CRS.Simple,
      ...MAP_CONFIG,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer(TILE_URL, {
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      noWrap: true,
      // BWIKI 瓦片用 tile-{x}_{y}.png 格式，Leaflet 默认 {z}/{x}/{y} 需要调整
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    textLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 渲染点位 marker（visibleTypes 变化时更新）
  useEffect(() => {
    if (!markerLayerRef.current) return;
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
  }, [points, visibleTypes]);

  // 渲染文字图层（地名标注，随 zoom 级别显隐）
  useEffect(() => {
    if (!textLayerRef.current || !mapRef.current) return;
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
  }, [textLayers]);

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
