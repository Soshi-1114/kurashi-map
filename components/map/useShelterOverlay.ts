// 指定緊急避難場所のプロット。災害オーバーレイで「避難所」を選択中のときだけ、対象自治体
// （選択中＋SHELTER_ZOOM 以上なら視界内の市区町村）の避難場所を取得して点を出す。同時に
// 災害種別も選択していれば、そのいずれかに有効な避難場所だけに絞る（複数選択は和）。
// 災害種別を1つも選んでいなければ全件出す。条件を外れたら点を消す。moveend でも再評価
// （地図初期化側が返り値の refreshRef を moveend に紐付ける）。
import { useEffect, useRef, type MutableRefObject } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { HAZARD_OVERLAYS } from "@/lib/mapHazards";
import { EMPTY_FC, SHELTER_KEY, SHELTER_ZOOM, type OverlayKey } from "./mapConstants";

// 取得結果キャッシュの上限（自治体数）。パンし続けるセッションで全1,900自治体ぶんの
// FC を抱え込まないよう、挿入順（≒最終取得順）で古いものから捨てる。
const SHELTER_CACHE_MAX = 80;

type Params = {
  mapRef: MutableRefObject<MapLibreMap | null>;
  mapReady: boolean;
  overlays: Set<OverlayKey>;
  selectedCode: string | null;
  selectedCodeRef: MutableRefObject<string | null>;
  /** 政令市の区→親市コード。親市（全区合算済み）を優先して点の二重描画を防ぐ。 */
  childToParent: Map<string, string>;
};

export function useShelterOverlay({
  mapRef, mapReady, overlays, selectedCode, selectedCodeRef, childToParent,
}: Params): MutableRefObject<(() => void) | null> {
  // 避難場所の取得結果キャッシュ（code → 全点FC、未収録は null）。ハザード種別の切替で
  // 再取得せず同じFCを種別フィルタし直すために全点を保持する。
  const cacheRef = useRef<Map<string, GeoJSON.FeatureCollection | null>>(new Map());
  // 取得の世代トークン（パン連打時に古い結果で上書きしないため）。
  const reqRef = useRef(0);
  // 最新の選択中オーバーレイ集合を地図のイベント（moveend）から参照する ref。
  const overlaysRef = useRef<Set<OverlayKey>>(new Set());
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    overlaysRef.current = overlays;
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const setVisible = (v: boolean) => {
      for (const id of ["shelter-points", "shelter-labels"]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
      }
    };
    const src = () => map.getSource("shelters") as GeoJSONSource | undefined;

    const refresh = async () => {
      const ov = overlaysRef.current;
      if (!ov.has(SHELTER_KEY)) { src()?.setData(EMPTY_FC); setVisible(false); return; }
      // 同時選択中の災害種別（避難所を除く）。空なら種別で絞らず全件。
      const hazardKeys = HAZARD_OVERLAYS.map((h) => h.key).filter((k) => ov.has(k));

      // 対象コード = 選択中 ＋（高ズーム時のみ）視界内の市区町村/区。
      const codes = new Set<string>();
      const sel = selectedCodeRef.current;
      if (sel) codes.add(sel);
      if (map.getZoom() >= SHELTER_ZOOM) {
        const layers = ["muni-fill", "wards-fill"].filter((id) => map.getLayer(id));
        try {
          for (const f of map.queryRenderedFeatures({ layers })) {
            const c = String(f.properties?.code ?? "");
            if (c) codes.add(c);
          }
        } catch { /* スタイル未確定時などは無視 */ }
      }
      // 政令市は親市が全区の点を合算済み。親と区が両方入る時は区を落として二重描画を防ぐ。
      for (const c of [...codes]) {
        const parent = childToParent.get(c);
        if (parent && codes.has(parent)) codes.delete(c);
      }
      if (codes.size === 0) { src()?.setData(EMPTY_FC); setVisible(false); return; }

      const token = ++reqRef.current;
      await Promise.all([...codes].map(async (c) => {
        if (cacheRef.current.has(c)) return;
        try {
          const r = await fetch(`/api/shelters/${c}`);
          const d = r.ok ? ((await r.json()) as { features?: GeoJSON.Feature[] }) : null;
          cacheRef.current.set(c, d ? { type: "FeatureCollection", features: d.features ?? [] } : null);
        } catch { cacheRef.current.set(c, null); }
      }));
      if (token !== reqRef.current) return; // より新しい要求が来ていれば破棄

      // 上限超過ぶんを挿入順で間引く（今回の対象 codes は残す）。
      if (cacheRef.current.size > SHELTER_CACHE_MAX) {
        for (const key of cacheRef.current.keys()) {
          if (cacheRef.current.size <= SHELTER_CACHE_MAX) break;
          if (!codes.has(key)) cacheRef.current.delete(key);
        }
      }

      const matches = (f: GeoJSON.Feature) =>
        hazardKeys.length === 0 || hazardKeys.some((k) => f.properties?.[k] === true);
      const feats: GeoJSON.Feature[] = [];
      for (const c of codes) {
        const fc = cacheRef.current.get(c);
        if (fc) for (const f of fc.features) if (matches(f)) feats.push(f);
      }
      const s = src();
      if (!s) return;
      s.setData({ type: "FeatureCollection", features: feats });
      setVisible(feats.length > 0);
    };

    refreshRef.current = refresh;
    void refresh();
  }, [overlays, selectedCode, mapReady, childToParent, mapRef, selectedCodeRef]);

  return refreshRef;
}
