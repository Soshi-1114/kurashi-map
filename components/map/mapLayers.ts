// 地図のソース／レイヤー定義（都道府県・市区町村・行政区のコロプレスと選択リング、
// GSI ハザード実区域ラスタ、指定緊急避難場所の点）。MapView の初期化 effect から
// 1回だけ呼ばれる。イベントハンドラ（クリック・ホバー）は state を触るため
// MapView 側に置き、ここは「何をどの順で描くか」だけを持つ。
import type { Map as MapLibreMap, DataDrivenPropertyValueSpecification } from "maplibre-gl";
import { getMapMetric, DEFAULT_METRIC_KEY } from "@/lib/mapMetrics";
import {
  HAZARD_OVERLAYS, HAZARD_ZONE_ZOOM, GSI_HAZARD_ATTRIBUTION, gsiTileUrl,
} from "@/lib/mapHazards";
import { SHELTER_ATTRIBUTION } from "@/lib/shelters";
import {
  WARDS_MIN_ZOOM, MUNI_MIN_ZOOM, PREF_FADE_END_ZOOM, DEFAULT_MAP_METRIC,
} from "./mapConstants";
import { MUNI_FILL_OPACITY } from "./mapHelpers";

export function addKurashiLayers(
  map: MapLibreMap,
  geo: {
    prefGeo: GeoJSON.FeatureCollection;
    muniGeo: GeoJSON.FeatureCollection;
    wardsGeo: GeoJSON.FeatureCollection;
  },
) {
  map.addSource("prefectures", { type: "geojson", data: geo.prefGeo, promoteId: "code" });
  map.addSource("muni", { type: "geojson", data: geo.muniGeo, promoteId: "code" });
  map.addSource("wards", { type: "geojson", data: geo.wardsGeo, promoteId: "code" });

  // 地名ラベル等の symbol レイヤーより下にコロプレスを差し込む
  const firstSymbolId = (map.getStyle().layers ?? []).find((l) => l.type === "symbol")?.id;

  // ===== 都道府県レイヤー（低ズームで前面、高ズームでフェードアウト）=====
  map.addLayer({
    id: "pref-fill",
    type: "fill",
    source: "prefectures",
    paint: {
      "fill-color": [
        "case",
        ["boolean", ["feature-state", "hover"], false], "#2563eb",
        "rgba(37, 99, 235, 0.08)",
      ],
      "fill-opacity": [
        "interpolate", ["linear"], ["zoom"],
        5, 0.7,
        7, 0.5,
        PREF_FADE_END_ZOOM, 0,
      ],
    },
  }, firstSymbolId);
  map.addLayer({
    id: "pref-outline",
    type: "line",
    source: "prefectures",
    paint: {
      "line-color": "rgba(15, 23, 42, 0.45)",
      "line-width": [
        "case",
        ["boolean", ["feature-state", "hover"], false], 2.0,
        0.8,
      ],
      "line-opacity": [
        "interpolate", ["linear"], ["zoom"],
        5, 1,
        8, 0.6,
        PREF_FADE_END_ZOOM, 0.2,
        11, 0,
      ],
    },
  }, firstSymbolId);

  // 家賃コロプレス（透過強め、地図が透ける）
  map.addLayer({
    id: "muni-fill",
    type: "fill",
    source: "muni",
    minzoom: MUNI_MIN_ZOOM,
    paint: {
      "fill-color": getMapMetric(DEFAULT_METRIC_KEY).colorExpression() as DataDrivenPropertyValueSpecification<string>,
      "fill-opacity": DEFAULT_MAP_METRIC === "none" ? 0 : MUNI_FILL_OPACITY,
    },
  }, firstSymbolId);
  // 絞り込み減光：条件に該当しない自治体を白でマスク（既定は非表示。
  // 塗り分け・災害オーバーレイには手を入れず、この層だけを被せる）
  map.addLayer({
    id: "muni-dim",
    type: "fill",
    source: "muni",
    minzoom: MUNI_MIN_ZOOM,
    layout: { visibility: "none" },
    paint: { "fill-color": "#f8fafc", "fill-opacity": 0.66 },
  }, firstSymbolId);
  // 災害リスク オーバーレイは拡大時（HAZARD_ZONE_ZOOM 以上）に実区域ラスタだけで
  // 描く。低ズームの自治体集計ハッチは「ほぼ全自治体に斜線が乗って意味を成さない」
  // ため廃止し、閾値未満では地図には何も重ねず UI 側でズーム誘導を出す。
  // 境界線
  map.addLayer({
    id: "muni-outline",
    type: "line",
    source: "muni",
    minzoom: MUNI_MIN_ZOOM,
    paint: {
      "line-color": "rgba(15, 23, 42, 0.42)",
      "line-width": [
        "case",
        ["boolean", ["feature-state", "hover"], false], 1.8,
        0.8,
      ],
    },
  }, firstSymbolId);
  // 選択中ハイライト（明るいリング）
  map.addLayer({
    id: "muni-selected",
    type: "line",
    source: "muni",
    minzoom: MUNI_MIN_ZOOM,
    paint: {
      "line-color": "#1d4ed8",
      "line-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false], 3.6,
        0,
      ],
      "line-blur": 0.4,
    },
  }, firstSymbolId);

  // ===== 政令市の行政区レイヤー（ズーム閾値以上で表示）=====
  map.addLayer({
    id: "wards-fill",
    type: "fill",
    source: "wards",
    minzoom: WARDS_MIN_ZOOM,
    paint: {
      "fill-color": getMapMetric(DEFAULT_METRIC_KEY).colorExpression() as DataDrivenPropertyValueSpecification<string>,
      "fill-opacity": DEFAULT_MAP_METRIC === "none" ? 0 : MUNI_FILL_OPACITY,
    },
  }, firstSymbolId);
  map.addLayer({
    id: "wards-dim",
    type: "fill",
    source: "wards",
    minzoom: WARDS_MIN_ZOOM,
    layout: { visibility: "none" },
    paint: { "fill-color": "#f8fafc", "fill-opacity": 0.66 },
  }, firstSymbolId);
  // 実区域ラスタ（国土地理院ハザードマップポータルの公開タイル）。拡大時のみ表示し、
  // 自治体集計ハッチに代わって実際の浸水想定区域ポリゴンを公式の深さ凡例で描く。
  // API キー不要・CORS 可。種別ごとに1ソース/レイヤーを用意し、選択中のみ可視化。
  for (const h of HAZARD_OVERLAYS) {
    // 土砂は3レイヤー（土石流/急傾斜/地すべり）。種別ごとに layerId 分のソース/レイヤーを作る。
    h.gsiLayerIds.forEach((layerId, i) => {
      const sid = `gsi-${h.key}-${i}`;
      map.addSource(sid, {
        type: "raster",
        tiles: [gsiTileUrl(layerId)],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 17,
        attribution: GSI_HAZARD_ATTRIBUTION,
      });
      map.addLayer({
        id: sid,
        type: "raster",
        source: sid,
        minzoom: HAZARD_ZONE_ZOOM,
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0.7 },
      }, firstSymbolId);
    });
  }
  map.addLayer({
    id: "wards-outline",
    type: "line",
    source: "wards",
    minzoom: WARDS_MIN_ZOOM,
    paint: {
      "line-color": "rgba(15, 23, 42, 0.42)",
      "line-width": [
        "case",
        ["boolean", ["feature-state", "hover"], false], 1.8,
        0.8,
      ],
    },
  }, firstSymbolId);
  map.addLayer({
    id: "wards-selected",
    type: "line",
    source: "wards",
    minzoom: WARDS_MIN_ZOOM,
    paint: {
      "line-color": "#1d4ed8",
      "line-width": [
        "case",
        ["boolean", ["feature-state", "selected"], false], 3.6,
        0,
      ],
      "line-blur": 0.4,
    },
  }, firstSymbolId);

  // ===== 指定緊急避難場所のポイント層 =====
  // 「災害オーバーレイON かつ 市区町村選択中」のときだけ、その災害に有効な避難場所を
  // /api/shelters/[code] から取得して点を描く（useShelterOverlay が setData する）。
  // 初期は空。symbol ラベルより前面に出すため beforeId を付けず最前面へ積む。
  map.addSource("shelters", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    attribution: SHELTER_ATTRIBUTION,
  });
  map.addLayer({
    id: "shelter-points",
    type: "circle",
    source: "shelters",
    minzoom: MUNI_MIN_ZOOM,
    layout: { visibility: "none" },
    paint: {
      // 避難場所の慣用色（緑）。家賃/ハザード(amber)と色相を分け点だと分かるように。
      "circle-color": "#0f9d58",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.4,
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        10, 3.5,
        13, 5.5,
        16, 8,
      ],
      "circle-opacity": 0.92,
    },
  });
  map.addLayer({
    id: "shelter-labels",
    type: "symbol",
    source: "shelters",
    minzoom: 14, // 名称は十分拡大してから（密集時の被り防止）
    layout: {
      visibility: "none",
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-optional": true,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#065f3a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4,
    },
  });
}
