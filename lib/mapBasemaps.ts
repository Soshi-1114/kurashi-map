// 地図のベース（下地）スタイル。スタイル切替ボタンから選ぶ。
// - 標準: OpenFreeMap positron（ベクタ。淡色でコロプレスが読みやすい既定）
// - 地理院地図: 国土地理院ラスタタイル（河川・鉄道・地名が最初から描かれる）
// - 詳細: OpenFreeMap bright（positron と同一タイル源。駅・施設名・町丁名まで表示）
//
// 切替は MapView の setStyle + transformStyle で行い、自前レイヤー（コロプレス・
// ハザード・実区域）は引き継ぐ。GSI ラスタの source/layer 名は "basemap" にして、
// ハザード実区域レイヤー（"gsi-*"）と接頭辞が衝突しないようにしている。

import type { StyleSpecification } from "maplibre-gl";

export type BasemapKey = "simple" | "pale" | "bright";

// 国土地理院タイルの出典表記（必須）。
const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';

// GSI ラスタ1枚もののスタイル（pale=淡色地図）。
function gsiRasterStyle(layer: string, maxzoom: number): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [`https://cyberjapandata.gsi.go.jp/xyz/${layer}/{z}/{x}/{y}.png`],
        tileSize: 256,
        minzoom: 2,
        maxzoom,
        attribution: GSI_ATTRIBUTION,
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

export type Basemap = { key: BasemapKey; label: string; style: string | StyleSpecification };

export const BASEMAPS: readonly Basemap[] = [
  { key: "simple", label: "標準", style: "https://tiles.openfreemap.org/styles/positron" },
  { key: "bright", label: "詳細", style: "https://tiles.openfreemap.org/styles/bright" },
  { key: "pale", label: "地理院地図", style: gsiRasterStyle("pale", 18) },
];

export const DEFAULT_BASEMAP: BasemapKey = "simple";

export function getBasemap(key: BasemapKey): Basemap {
  return BASEMAPS.find((b) => b.key === key) ?? BASEMAPS[0];
}
