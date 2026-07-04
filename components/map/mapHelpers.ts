// MapView の純関数ヘルパー（React 非依存）。geojson 取得・bbox 計算・
// ベース地図ラベルの制御など、地図初期化と操作系 effect の両方から使う。
import type { Map as MapLibreMap, DataDrivenPropertyValueSpecification } from "maplibre-gl";
import { EMPTY_FC } from "./mapConstants";

// 起動時 geojson の取得。失敗（オフライン・CDN障害）で map.on("load") ハンドラごと
// 落ちると地図全体が死ぬため、1回リトライした上で空コレクションに縮退する
// （ベース地図・検索は生きるので、真っ白な画面よりよい）。
export async function fetchGeoJsonOrEmpty(url: string): Promise<GeoJSON.FeatureCollection> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as GeoJSON.FeatureCollection;
    } catch (e) {
      if (attempt === 0) continue;
      console.error("geojson 取得失敗（空データで続行）:", url, e);
    }
  }
  return EMPTY_FC;
}

export function computeBbox(geom: GeoJSON.Geometry): [[number, number], [number, number]] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (coords: unknown) => {
    if (typeof coords === "number") return;
    if (Array.isArray(coords)) {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        const x = coords[0] as number;
        const y = coords[1] as number;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        return;
      }
      for (const c of coords) visit(c);
    }
  };
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
    visit(geom.coordinates);
  } else {
    return null;
  }
  if (!isFinite(minX)) return null;
  return [[minX, minY], [maxX, maxY]];
}

// コロプレス塗りの不透明度（選択0.85 / ホバー0.7 / 既定0.55）。塗り分け「なし」では
// 0 に差し替えて非表示にする（visibility:none と違いクリック判定は残すため opacity で制御）。
export const MUNI_FILL_OPACITY = [
  "case",
  ["boolean", ["feature-state", "selected"], false], 0.85,
  ["boolean", ["feature-state", "hover"], false], 0.7,
  0.55,
] as unknown as DataDrivenPropertyValueSpecification<number>;

// 選択時に減光するベース地図ラベル（道路名・水系名等）の記録。元の opacity を保存し、
// 選択解除で復元する（place=地名ラベルは対象外）。
export type LabelDimState = { ids: string[]; text: Map<string, unknown>; icon: Map<string, unknown> };

// 現ベース地図の「道路名・水系名等」ラベル群（place=地名は除く）を控える。
// 選択時の減光に使う。スタイル切替後にも呼んで取り直す。
export function collectBaseLabels(map: MapLibreMap, ref: LabelDimState) {
  const layers = map.getStyle().layers ?? [];
  const ids = layers
    .filter((l) => l.type === "symbol" && (l as { "source-layer"?: string })["source-layer"] !== "place")
    .map((l) => l.id);
  ref.ids = ids;
  ref.text.clear();
  ref.icon.clear();
  for (const id of ids) {
    ref.text.set(id, map.getPaintProperty(id, "text-opacity"));
    ref.icon.set(id, map.getPaintProperty(id, "icon-opacity"));
  }
}

// ラベルを日本語優先に書き換え（OSMの name:ja があれば優先、無ければ name）
export function applyJapaneseLabels(map: MapLibreMap) {
  const allLayers = map.getStyle().layers ?? [];
  for (const layer of allLayers) {
    if (layer.type !== "symbol") continue;
    const layout = (layer as { layout?: { "text-field"?: unknown } }).layout;
    if (!layout?.["text-field"]) continue;
    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name:ja"],
      ["get", "name:latin"],
      ["get", "name"],
    ]);
  }
}
