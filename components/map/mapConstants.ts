// MapView 系コンポーネント共通の定数・型。MapView.tsx 本体から分離し、
// 凡例・レイヤーパネル・避難所フックが同じ値を参照する単一ソースにする。
import type { HazardOverlayKey } from "@/lib/mapHazards";
import type { MapMetricKey } from "@/lib/mapMetrics";

export const WARDS_MIN_ZOOM = 11;      // 政令市の行政区レイヤーを出すズーム
export const MUNI_MIN_ZOOM = 7.5;      // 市区町村レイヤーを出すズーム
export const SHELTER_ZOOM = 12;        // このズーム以上で視界内自治体の避難場所を出す（災害ON時）
export const PREF_FADE_END_ZOOM = 9;   // 都道府県レイヤーの fill が完全に消えるズーム
export const PREF_CLICK_MAX_ZOOM = 8;  // この zoom 以下で pref クリックを fly-in 扱い

// ベース地図は lib/mapBasemaps.ts（シンプル=OpenFreeMap positron / 淡色=GSI）。
// 初期表示は東京湾を中心に、湾を囲む首都圏（東京・横浜・川崎・千葉・房総基部）が
// 収まる枠。よくある地図のように湾が画面中央に来る。bbox は固定値（島嶼部は含めない）。
export const TOKYO_BAY_BBOX: [number, number, number, number] = [139.45, 35.1, 140.2, 35.78];

// 地図の初期既定: 塗り分けは「なし」（地図＋災害オーバーレイだけ見える素の状態）。
export const DEFAULT_MAP_METRIC: MapMetricKey | "none" = "none";

export const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// 災害オーバーレイは複数選択可。5つの災害種別（HAZARD_OVERLAYS）＋避難所(shelter)を
// 集合で保持する。避難所は「選択時のみ」点をプロットするトグル。
export type OverlayKey = Exclude<HazardOverlayKey, "none"> | "shelter";
export const SHELTER_KEY: OverlayKey = "shelter";
