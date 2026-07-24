"use client";

import dynamic from "next/dynamic";
import type { MapPoint, MapTextLayer } from "@/types/map";

// Leaflet 是客户端库，必须在 Client Component 里用 ssr:false 动态导入
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-[600px] animate-pulse rounded-xl bg-surface-2" />,
});

export default function MapViewClient({
  points,
  textLayers,
}: {
  points: MapPoint[];
  textLayers?: MapTextLayer[];
}) {
  return <MapView points={points} textLayers={textLayers} />;
}
