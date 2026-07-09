"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// maplibre-gl の値（~209KB）は地図初期化の useEffect 内で動的 import() し、
// 初期バンドル＝メインスレッドのクリティカルパスから外す（モバイルの TBT 改善）。
// MapView 本体は SSR されるためヘッダー・検索・凡例が即時描画され、LCP 要素が
// JS 実行完了(TTI)に張り付くのを防ぐ。型のみここで取り込む（実行時に消える）。
import type {
  Map as MapLibreMap,
  MapMouseEvent,
  GeoJSONSource,
  MapGeoJSONFeature,
  DataDrivenPropertyValueSpecification,
  FilterSpecification,
  StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Municipality, MuniSummary } from "@/lib/types";
import { PREFS, getPrefByCode } from "@/lib/prefs";
import { hasRent } from "@/lib/rentColor";
import { getMapMetric, TREND_PROPERTY, type MapMetricKey } from "@/lib/mapMetrics";
import { trackSelectMunicipality, trackChangeMetric, trackApplyFilter } from "@/lib/analytics";
import {
  EMPTY_FILTERS, isFilterActive, matchesFilter, buildMatchExpression, type MapFilters,
} from "@/lib/mapFilters";
import {
  HAZARD_OVERLAYS, HAZARD_ZONE_ZOOM, INUNDATION_KEYS, isInundationKey,
} from "@/lib/mapHazards";
import { DEFAULT_BASEMAP, getBasemap, type BasemapKey } from "@/lib/mapBasemaps";
import {
  WARDS_MIN_ZOOM, MUNI_MIN_ZOOM, PREF_CLICK_MAX_ZOOM, TOKYO_BAY_BBOX,
  DEFAULT_MAP_METRIC, SHELTER_KEY, type OverlayKey,
} from "./map/mapConstants";
import {
  fetchGeoJsonOrEmpty, computeBbox, collectBaseLabels, applyJapaneseLabels,
  MUNI_FILL_OPACITY, type LabelDimState,
} from "./map/mapHelpers";
import { addKurashiLayers } from "./map/mapLayers";
import { useShelterOverlay } from "./map/useShelterOverlay";
import MetricLegend from "./map/MetricLegend";
import LayersPanel from "./map/LayersPanel";
import MuniSearch from "./map/MuniSearch";
import AreaPanel from "./AreaPanel";
import MobileSheet from "./MobileSheet";

type Props = { summary: MuniSummary[]; onMenuClick?: () => void; initialMetric?: MapMetricKey | "none" };

export default function MapView({ summary, onMenuClick, initialMetric = DEFAULT_MAP_METRIC }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const muniGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const wardsGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const prefGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const ensurePrefsRef = useRef<((slugs: string[]) => Promise<void>) | null>(null);
  const selectedCodeRef = useRef<string | null>(null);
  // 直前に selected=true にした自治体コード。選択変更時に「前回を false / 今回を true」
  // の2回だけ setFeatureState すれば済むよう保持する（全件 forEach の O(n) を回避）。
  const prevSelectedRef = useRef<string | null>(null);
  const hoveredCodeRef = useRef<string | null>(null);
  const hoveredSourceRef = useRef<"muni" | "wards" | null>(null);
  const activeMetricRef = useRef<MapMetricKey | "none">(initialMetric);
  // 選択時に減光するベース地図ラベル（道路名・水系名等。place=地名は残す）。
  // 元の opacity を保存し、選択解除で復元する。
  const labelDimRef = useRef<LabelDimState>({ ids: [], text: new Map(), icon: new Map() });
  // 地図初期化完了前に検索確定された自治体コード（初期化後に flyTo を実行する）。
  const pendingFlyRef = useRef<string | null>(null);

  // ベース地図スタイル。state は UI 表示用、ref は地図初期化 effect が再実行されない
  // よう現在値を保持する用。
  const [basemap, setBasemap] = useState<BasemapKey>(DEFAULT_BASEMAP);
  const basemapRef = useRef<BasemapKey>(DEFAULT_BASEMAP);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  // 災害オーバーレイ（複数選択）。空集合＝何も重ねない。
  const [overlays, setOverlays] = useState<Set<OverlayKey>>(() => new Set());
  const toggleOverlay = useCallback((key: OverlayKey) => {
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); return next; }
      // 浸水・津波・高潮は同一「浸水深」配色で重ねても区別できないため排他選択にする
      // （新たに浸水系を選んだら他の浸水系を外す）。土砂・避難所は併用可のまま。
      if (isInundationKey(key)) {
        for (const k of INUNDATION_KEYS) next.delete(k);
      }
      next.add(key);
      return next;
    });
  }, []);
  const [activeMetric, setActiveMetric] = useState<MapMetricKey | "none">(initialMetric);
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);
  const [isMobile, setIsMobile] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  // 初回ビューのポリゴンが描画され切るまで true にしない（凡例先行・白地図対策）
  const [firstPaintReady, setFirstPaintReady] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; label: string; value: string; flip: boolean } | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);
  // ハザード実区域ラスタの表示ズーム（HAZARD_ZONE_ZOOM）に達しているか。未満の間は
  // 地図に何も重ねず凡例で「ズームしてください」と誘導する（斜線ハッチは廃止）。
  const [belowHazardZoom, setBelowHazardZoom] = useState(true);
  // 選択中自治体のフル詳細（/api/muni/[code] で取得）。サマリには無い人口/地価等を含む
  const [selectedDetail, setSelectedDetail] = useState<Municipality | null>(null);
  // スクリーンリーダー向けの選択アナウンス（視覚的には非表示のライブリージョンで読み上げる）。
  const [announcement, setAnnouncement] = useState("");

  const { municipalities, wards } = useMemo(() => {
    const mu: MuniSummary[] = [];
    const wa: MuniSummary[] = [];
    for (const x of summary) (x.level === "ward" ? wa : mu).push(x);
    return { municipalities: mu, wards: wa };
  }, [summary]);

  // 政令市の区→親市コード。視界内に親市と区が同時に入る時、親市エントリ（全区の点を
  // 合算済み）を優先して区を落とし、避難場所の点の二重描画を防ぐ。
  const childToParent = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of wards) if (w.parentCode) m.set(w.code, w.parentCode);
    return m;
  }, [wards]);

  const byCode = useMemo(() => {
    const m = new Map<string, MuniSummary>();
    for (const x of summary) m.set(x.code, x);
    return m;
  }, [summary]);

  useEffect(() => {
    const detect = () => setIsMobile(window.innerWidth < 768);
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  // 指定緊急避難場所のプロット（詳細は useShelterOverlay）。moveend の再評価用に
  // 最新の refresh 関数を ref で受け取り、地図初期化時にイベントへ紐付ける。
  const shelterRefreshRef = useShelterOverlay({
    mapRef, mapReady, overlays, selectedCode, childToParent,
  });

  // 自治体コードを画面内に収める。SP は下部シート分、PC は右パネル分の余白を確保。
  // （地図初期化 effect のクリックハンドラからも使うため、effect より前に宣言する）
  const flyToCode = useCallback((code: string) => {
    const map = mapRef.current;
    if (!map) return;
    // muniGeo にあれば muni、なければ wardsGeo を見る
    const muniFeat = muniGeoRef.current?.features.find(
      (x) => String(x.properties?.code) === code,
    );
    const wardFeat = !muniFeat
      ? wardsGeoRef.current?.features.find((x) => String(x.properties?.code) === code)
      : undefined;
    const feat = muniFeat || wardFeat;
    if (!feat) return;
    const bbox = computeBbox(feat.geometry);
    if (!bbox) return;
    const sp = typeof window !== "undefined" && window.innerWidth < 768;
    // SP は header (~60px) + half シート (~200px) を避けて選択ポリゴンを画面内に収める。
    // full は modal で地図を覆うので fit は half 基準で OK。
    const padding = sp
      ? { top: 80, bottom: 264, left: 24, right: 24 }
      : { top: 80, bottom: 60, left: 60, right: 420 };
    // 区を選択した時は最低 z=11 まで寄せて区レイヤーが見える状態に
    const minZoom = wardFeat ? WARDS_MIN_ZOOM : 0;
    const currentZoom = map.getZoom();
    map.fitBounds(bbox, { padding, maxZoom: 13.5, duration: 800 });
    if (wardFeat && currentZoom < minZoom) {
      // fitBounds の結果が minZoom 未満ならズーム引き上げ
      setTimeout(() => {
        if (map.getZoom() < minZoom) map.easeTo({ zoom: minZoom, duration: 400 });
      }, 850);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const startInit = () => void (async () => {
      const { default: maplibregl } = await import("maplibre-gl");
      // 動的 import 中にアンマウントされた / 既にマップが立っていれば中断
      if (disposed || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getBasemap(basemapRef.current).style,
        center: [139.825, 35.44],
        zoom: 9,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-right");

      const mergeFeatureData = (geo: GeoJSON.FeatureCollection) => {
        for (const f of geo.features) {
          const code = String(f.properties?.code ?? "");
          const m = byCode.get(code);
          if (!m) continue;
          f.properties = {
            ...f.properties,
            rent: m.rent,
            landPrice: m.landPrice,
            [TREND_PROPERTY]: m.populationTrend ?? "",
            foreignRatio: m.foreignRatio,
            name: m.name,
            floodLevel: m.floodLevel, // -1=対象外, 0=なし, 1..6
            landslideLevel: m.landslideLevel,
            tsunamiLevel: m.tsunamiLevel,
            stormSurgeLevel: m.stormSurgeLevel,
            liquefactionLevel: m.liquefactionLevel,
          };
        }
      };

      map.on("load", async () => {
        map.fitBounds(TOKYO_BAY_BBOX, { padding: 40, duration: 0 });
        // prefectures(47県の輪郭, 約580KB)だけ起動時にロード。各県の市区町村/区
        // ポリゴンは全件で22MB超あり SP 実機で破綻するため、ズームしてビューポートに
        // 入った県だけを遅延ロードする（下の ensurePrefs / checkViewport）。
        const prefGeo = await fetchGeoJsonOrEmpty("/prefectures.geojson");
        prefGeoRef.current = prefGeo;
        // muni / wards は空で開始し、遅延ロードのたびに features を足して setData する
        const muniGeo: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        const wardsGeo: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        muniGeoRef.current = muniGeo;
        wardsGeoRef.current = wardsGeo;

        applyJapaneseLabels(map);

        // 自治体選択時に減光する「道路名・水系名等」のラベル群を控えておく
        // （source-layer="place" の地名ラベルは選択中も読めるよう対象外）。
        collectBaseLabels(map, labelDimRef.current);

        // コロプレス・ハザードラスタ・避難場所のソース/レイヤーを一括追加。
        addKurashiLayers(map, { prefGeo, muniGeo, wardsGeo });

        // クリック処理は最前面の1フィーチャだけに適用する（レイヤー別の delegated
        // ハンドラだと、政令市（z>=11）で親市 muni-fill と区 wards-fill が両方発火し
        // 選択・計測・fly が二重実行される。避難所の点クリック抑止フラグも不要になる）。
        map.on("mouseenter", "shelter-points", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "shelter-points", () => { map.getCanvas().style.cursor = ""; });
        map.on("click", (e) => {
          const layers = ["shelter-points", "wards-fill", "muni-fill"].filter((id) => map.getLayer(id));
          if (!layers.length) return;
          // queryRenderedFeatures は描画順の最前面から返る（点 > 区 > 親市）。
          const f = map.queryRenderedFeatures(e.point, { layers })[0];
          if (!f) return;
          if (f.layer.id === "shelter-points") {
            // 避難場所クリックで名称をツールチップ表示（指標ツールチップを流用）。
            const canvasW = map.getCanvas().clientWidth;
            setTooltip({
              x: e.point.x,
              y: e.point.y,
              name: String(f.properties?.name ?? "避難場所"),
              label: "指定緊急避難場所",
              value: String(f.properties?.address ?? ""),
              flip: e.point.x > canvasW - 200,
            });
            return;
          }
          const code = String(f.properties?.code ?? "");
          if (!code) return;
          setSelectedCode(code);
          trackSelectMunicipality(code, "map");
          flyToCode(code);
        });

        // 都道府県クリック → その県内まで fly-in（pref outline がまだ見える低〜中ズーム時のみ）
        let hoveredPrefRef = "";
        map.on("click", "pref-fill", (e) => {
          if (map.getZoom() >= PREF_CLICK_MAX_ZOOM) return; // 高ズームでは pref クリックを無視
          const f = e.features?.[0];
          if (!f) return;
          const bbox = computeBbox(f.geometry);
          if (!bbox) return;
          const sp = typeof window !== "undefined" && window.innerWidth < 768;
          map.fitBounds(bbox, {
            padding: sp ? { top: 80, bottom: 264, left: 24, right: 24 } : { top: 60, bottom: 60, left: 60, right: 60 },
            maxZoom: 9.5,
            duration: 900,
          });
        });
        map.on("mousemove", "pref-fill", (e) => {
          if (map.getZoom() >= PREF_CLICK_MAX_ZOOM) return;
          const f = e.features?.[0];
          if (!f) return;
          const code = String(f.properties?.code ?? "");
          if (hoveredPrefRef && hoveredPrefRef !== code) {
            map.setFeatureState({ source: "prefectures", id: hoveredPrefRef }, { hover: false });
          }
          hoveredPrefRef = code;
          map.setFeatureState({ source: "prefectures", id: code }, { hover: true });
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "pref-fill", () => {
          if (hoveredPrefRef) {
            map.setFeatureState({ source: "prefectures", id: hoveredPrefRef }, { hover: false });
            hoveredPrefRef = "";
          }
          map.getCanvas().style.cursor = "";
        });

        const onPolyMove = (sourceId: "muni" | "wards") =>
          (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
            const f = e.features?.[0];
            if (!f) return;
            const code = String(f.properties?.code ?? "");
            if (hoveredCodeRef.current && hoveredSourceRef.current &&
                (hoveredCodeRef.current !== code || hoveredSourceRef.current !== sourceId)) {
              map.setFeatureState(
                { source: hoveredSourceRef.current, id: hoveredCodeRef.current },
                { hover: false },
              );
            }
            hoveredCodeRef.current = code;
            hoveredSourceRef.current = sourceId;
            map.setFeatureState({ source: sourceId, id: code }, { hover: true });
            map.getCanvas().style.cursor = "pointer";
            const choice = activeMetricRef.current;
            // 右端付近ではツールチップをカーソルの左側に出して見切れを防ぐ
            const canvasW = map.getCanvas().clientWidth;
            // 塗り分け「なし」は自治体名だけ表示（指標値は出さない）。
            const metric = choice === "none" ? null : getMapMetric(choice);
            const propKey = metric && metric.key === "populationTrend" ? TREND_PROPERTY : metric?.key;
            setTooltip({
              x: e.point.x,
              y: e.point.y,
              name: String(f.properties?.name ?? ""),
              label: metric ? metric.label : "",
              value: metric && propKey ? metric.formatValue(f.properties?.[propKey]) : "",
              flip: e.point.x > canvasW - 200,
            });
          };
        map.on("mousemove", "muni-fill", onPolyMove("muni"));
        map.on("mousemove", "wards-fill", onPolyMove("wards"));
        const onPolyLeave = () => {
          if (hoveredCodeRef.current && hoveredSourceRef.current) {
            map.setFeatureState(
              { source: hoveredSourceRef.current, id: hoveredCodeRef.current },
              { hover: false },
            );
            hoveredCodeRef.current = null;
            hoveredSourceRef.current = null;
          }
          map.getCanvas().style.cursor = "";
          setTooltip(null);
        };
        map.on("mouseleave", "muni-fill", onPolyLeave);
        map.on("mouseleave", "wards-fill", onPolyLeave);

        // ===== 県単位の遅延ロード（ビューポートに入った県だけ取得）=====
        const codeToSlug = new Map(PREFS.map((p) => [p.codePrefix, p.slug]));
        const prefBySlug = new Map(PREFS.map((p) => [p.slug, p]));
        const prefBboxBySlug = new Map<string, [number, number, number, number]>();
        for (const f of prefGeo.features) {
          const slug = codeToSlug.get(String(f.properties?.code ?? "").slice(0, 2));
          if (!slug) continue;
          const bb = computeBbox(f.geometry);
          if (bb) prefBboxBySlug.set(slug, [bb[0][0], bb[0][1], bb[1][0], bb[1][1]]);
        }
        const loadedPrefs = new Set<string>();
        const bboxHit = (a: number[], b: number[]) =>
          !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

        // 失敗時はここでは握らず throw する（ensurePrefs 側の catch が loadedPrefs の
        // 印を外し、次の moveend で自然に再試行される）。r.ok チェックは 404 の HTML を
        // JSON parse エラーとして報告しないための明示。
        async function loadPrefGeo(p: (typeof PREFS)[number]) {
          const getJson = async (url: string) => {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
            return (await r.json()) as GeoJSON.FeatureCollection;
          };
          // 取得と反映を分離: wards だけ失敗した際の再試行で muni が二重 push
          // される（境界線の二重描画）のを防ぐため、全取得成功後に一括で反映する。
          const muni = await getJson(`/${p.slug}.geojson`);
          const wd = p.hasWards ? await getJson(`/${p.slug}_wards.geojson`) : null;
          mergeFeatureData(muni);
          muniGeoRef.current!.features.push(...muni.features);
          if (wd) {
            mergeFeatureData(wd);
            wardsGeoRef.current!.features.push(...wd.features);
          }
        }
        async function ensurePrefs(slugs: string[]) {
          const todo = [...new Set(slugs)].filter((s) => !loadedPrefs.has(s) && prefBySlug.has(s));
          if (!todo.length) return;
          todo.forEach((s) => loadedPrefs.add(s)); // 同期的に印を付け二重取得を防ぐ
          await Promise.all(
            todo.map((s) =>
              loadPrefGeo(prefBySlug.get(s)!).catch((err) => {
                loadedPrefs.delete(s);
                console.error("pref geojson load 失敗:", s, err);
              }),
            ),
          );
          (map.getSource("muni") as GeoJSONSource | undefined)?.setData(muniGeoRef.current!);
          (map.getSource("wards") as GeoJSONSource | undefined)?.setData(wardsGeoRef.current!);
          // setData で feature-state が消えるため、選択中の自治体をハイライトし直す
          const sel = selectedCodeRef.current;
          if (sel) {
            map.setFeatureState({ source: "muni", id: sel }, { selected: true });
            map.setFeatureState({ source: "wards", id: sel }, { selected: true });
          }
          // moveend 時点ではこの県のポリゴンが未描画で、避難場所の視界内評価
          // （queryRenderedFeatures）が空振りしている。描画が落ち着いてから再評価する
          // （避難所ONのまま未ロード県へ移動すると点が出ないままになるレースの解消）。
          map.once("idle", () => shelterRefreshRef.current?.());
        }
        ensurePrefsRef.current = ensurePrefs;
        // 初期化前に検索確定されていた自治体があればここで fly（保留の解消）。
        if (pendingFlyRef.current) {
          const code = pendingFlyRef.current;
          pendingFlyRef.current = null;
          const pp = getPrefByCode(code);
          void (async () => {
            if (pp) await ensurePrefs([pp.slug]);
            flyToCode(code);
          })();
        }

        function checkViewport() {
          if (map.getZoom() < MUNI_MIN_ZOOM) return; // 県レベル表示中は muni 不要
          const b = map.getBounds();
          const vb = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
          const slugs: string[] = [];
          for (const [slug, bb] of prefBboxBySlug) if (bboxHit(vb, bb)) slugs.push(slug);
          if (slugs.length) void ensurePrefs(slugs);
        }
        map.on("moveend", checkViewport);
        // ズーム/パンで視界が変わったら避難場所プロットを再評価（高ズーム時の視界内表示）。
        map.on("moveend", () => shelterRefreshRef.current?.());
        // ハザード実区域ラスタの表示閾値に達したかを追跡（凡例のズーム誘導に使う）。
        // setState は同値ならスキップされるため、ズーム中に毎フレーム呼んでも再描画は
        // 閾値をまたいだ時だけになる。
        const syncHazardZoom = () => setBelowHazardZoom(map.getZoom() < HAZARD_ZONE_ZOOM);
        map.on("zoom", syncHazardZoom);
        syncHazardZoom();

        setMapReady(true);

        // SP では出典（アトリビューション）を (i) ボタンに畳み、凡例・コントロールと
        // の干渉や右端の見切れを防ぐ。タップで展開できライセンス表記は維持される。
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          map
            .getContainer()
            .querySelector(".maplibregl-ctrl-attrib")
            ?.classList.remove("maplibregl-compact-show");
        }

        // 初期ビュー(東京付近)の県ポリゴンを await し、描画が落ち着いてから
        // ローディングオーバーレイを外す。idle が来ない環境向けに失敗保険も置く。
        if (map.getZoom() >= MUNI_MIN_ZOOM) {
          const b = map.getBounds();
          const vb = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
          const initSlugs: string[] = [];
          for (const [slug, bb] of prefBboxBySlug) if (bboxHit(vb, bb)) initSlugs.push(slug);
          await ensurePrefs(initSlugs);
        }
        map.once("idle", () => setFirstPaintReady(true));
        setTimeout(() => setFirstPaintReady(true), 6000);
      });

      mapRef.current = map;

      // コンテナサイズ変化に追従（初期レイアウト未確定対策含む）
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(containerRef.current);
      // 初期化直後の追加リサイズ
      requestAnimationFrame(() => map.resize());

      cleanup = () => {
        ro.disconnect();
        map.remove();
        mapRef.current = null;
      };
      // セットアップ完了前にアンマウントされていた場合は即座に後始末
      if (disposed) cleanup();
    })();

    // スケルトン(LCP 要素)の描画を先にコミットさせてから MapLibre(~209KB)の
    // import + 初期化に入る。低速端末では初期ペイント/LCP がマップ初期化(TTI)の
    // 裏に並んで待たされやすいので、メインスレッドの混雑窓を 1 サイクルずらす。
    // idle 非対応(Safari 等)は次フレーム相当(1ms)で起動する。
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let cancelStart: () => void;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(startInit, { timeout: 1500 });
      cancelStart = () => w.cancelIdleCallback?.(id);
    } else {
      const id = window.setTimeout(startInit, 1);
      cancelStart = () => window.clearTimeout(id);
    }

    return () => {
      disposed = true;
      cancelStart();
      cleanup?.();
    };
    // flyToCode（useCallback []）と shelterRefreshRef（ref）は安定しており再実行を招かない
  }, [byCode, flyToCode, shelterRefreshRef]);

  // 選択中の災害種別（複数可）に応じて、種別ごとの実区域ラスタの可視性を切り替える。
  // ズーム閾値（HAZARD_ZONE_ZOOM）未満ではラスタは minzoom により自動で出ない。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (const h of HAZARD_OVERLAYS) {
      const vis = overlays.has(h.key) ? "visible" : "none";
      h.gsiLayerIds.forEach((_, i) => {
        const id = `gsi-${h.key}-${i}`;
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
      });
    }
  }, [overlays, mapReady]);

  // 指標切替：muni/wards の fill-color を選択中メトリックの式に差し替える。
  // 「なし」は塗りの不透明度を 0 にして非表示（クリック判定は残す）。
  useEffect(() => {
    activeMetricRef.current = activeMetric;
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (const id of ["muni-fill", "wards-fill"]) {
      if (!map.getLayer(id)) continue; // スタイル再読込中はレイヤー不在があり得る
      if (activeMetric === "none") {
        map.setPaintProperty(id, "fill-opacity", 0);
      } else {
        map.setPaintProperty(id, "fill-color", getMapMetric(activeMetric).colorExpression() as DataDrivenPropertyValueSpecification<string>);
        map.setPaintProperty(id, "fill-opacity", MUNI_FILL_OPACITY);
      }
    }
  }, [activeMetric, mapReady]);

  // 条件フィルタ：非該当を減光レイヤーで覆う（フィルタ式の否定を filter に設定）。
  // 描画と件数を一致させるため、ここの match は matchesFilter（JS版）と同一条件。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const match = buildMatchExpression(filters);
    for (const id of ["muni-dim", "wards-dim"]) {
      if (!match) {
        map.setLayoutProperty(id, "visibility", "none");
      } else {
        map.setFilter(id, ["!", match] as FilterSpecification);
        map.setLayoutProperty(id, "visibility", "visible");
      }
    }
  }, [filters, mapReady]);

  // 自治体選択中はベース地図の道路名・水系名ラベルを減光し、選択ポリゴンと
  // パネルに視線を集める。地名(place)は残す。解除で元の opacity に復元。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const { ids, text, icon } = labelDimRef.current;
    const dim = !!selectedCode;
    for (const id of ids) {
      map.setPaintProperty(id, "text-opacity-transition", { duration: 300, delay: 0 });
      map.setPaintProperty(id, "icon-opacity-transition", { duration: 300, delay: 0 });
      map.setPaintProperty(id, "text-opacity", dim ? 0.35 : (text.get(id) ?? 1));
      map.setPaintProperty(id, "icon-opacity", dim ? 0.3 : (icon.get(id) ?? 1));
    }
  }, [selectedCode, mapReady]);

  useEffect(() => {
    selectedCodeRef.current = selectedCode;
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // 前回選択を解除し、今回選択のみ true にする（~1,900件の全件 forEach を回避）。
    // code が muni / wards どちらの source にあるか不定なので両方に投げる（無い側は no-op）。
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedCode) {
      map.setFeatureState({ source: "muni", id: prev }, { selected: false });
      map.setFeatureState({ source: "wards", id: prev }, { selected: false });
    }
    if (selectedCode) {
      map.setFeatureState({ source: "muni", id: selectedCode }, { selected: true });
      map.setFeatureState({ source: "wards", id: selectedCode }, { selected: true });
    }
    prevSelectedRef.current = selectedCode;
  }, [selectedCode, mapReady]);

  // 選択中自治体のフル詳細をオンデマンド取得（初期配信はサマリのみのため）
  useEffect(() => {
    if (!selectedCode) { setSelectedDetail(null); return; }
    let aborted = false;
    setSelectedDetail(null);
    fetch(`/api/muni/${selectedCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Municipality | null) => { if (!aborted) setSelectedDetail(d); })
      .catch(() => { if (!aborted) setSelectedDetail(null); });
    return () => { aborted = true; };
  }, [selectedCode]);

  // 選択の変化をスクリーンリーダーに読み上げる（地図はマウス/視覚前提のため、
  // 選択結果が非視覚利用者に伝わらないのを補う）。サマリから即時にアナウンスできる
  // よう byCode を使う（詳細 fetch の完了を待たない）。都道府県名も添えて文脈を明確にする。
  useEffect(() => {
    if (!selectedCode) { setAnnouncement(""); return; }
    const m = byCode.get(selectedCode);
    if (!m) return;
    const prefName = getPrefByCode(selectedCode)?.nameJa ?? "";
    setAnnouncement(`${prefName}${m.displayName ?? m.name} を選択しました`);
  }, [selectedCode, byCode]);

  // 条件フィルタの全国該当件数（JS判定。地図の減光と必ず同一条件）。
  const filterActive = isFilterActive(filters);
  const matchedCount = useMemo(
    () => (filterActive ? summary.reduce((n, m) => n + (matchesFilter(m, filters) ? 1 : 0), 0) : 0),
    [filterActive, filters, summary],
  );

  // フィルタ条件を更新しつつ GA4 に適用イベントを送る共通ハンドラ。
  const updateFilters = useCallback((next: MapFilters) => {
    setFilters(next);
    if (isFilterActive(next)) trackApplyFilter(next);
  }, []);

  // 指標切替（GA4 イベント付き）。「なし」はトラッキングしない。
  const changeMetric = useCallback((key: MapMetricKey | "none") => {
    setActiveMetric(key);
    if (key !== "none") trackChangeMetric(key);
  }, []);

  // ベース地図の切替。setStyle はベースごと全レイヤーを破棄するため、transformStyle で
  // 自前のソース/レイヤー（コロプレス・ハザード・実区域）を新ベースへ引き継ぐ。
  // setStyle で消える「画像（ハッチ）・選択 feature-state・ラベル群」は styledata で再適用。
  const switchBasemap = useCallback((key: BasemapKey) => {
    const map = mapRef.current;
    if (!map || key === basemapRef.current) return;
    basemapRef.current = key;
    setBasemap(key);
    const sourceIsOurs = (id: string) =>
      id === "prefectures" || id === "muni" || id === "wards" || id === "shelters" || id.startsWith("gsi-");
    const layerIsOurs = (id: string) => /^(pref-|muni-|wards-|gsi-|shelter-)/.test(id);
    map.setStyle(getBasemap(key).style, {
      transformStyle: (prev, next) => {
        if (!prev) return next;
        const keepSources = Object.fromEntries(
          Object.entries(prev.sources).filter(([id]) => sourceIsOurs(id)),
        );
        const ours = prev.layers.filter((l) => layerIsOurs(l.id));
        // 新ベースのラベル(symbol)より下に自前レイヤーを差し込む（ラスタは symbol 無し→末尾）。
        const at = next.layers.findIndex((l) => l.type === "symbol");
        const layers = [...next.layers];
        layers.splice(at < 0 ? layers.length : at, 0, ...ours);
        return { ...next, sources: { ...next.sources, ...keepSources }, layers } as StyleSpecification;
      },
    });
    map.once("styledata", () => {
      // 新ベースのラベルを日本語優先に差し替えてから、減光対象として収集し直す
      //（淡色→標準の戻しで latin 表記に戻るのを防ぐ）。
      applyJapaneseLabels(map);
      collectBaseLabels(map, labelDimRef.current);
      const sel = selectedCodeRef.current;
      if (sel) {
        map.setFeatureState({ source: "muni", id: sel }, { selected: true });
        map.setFeatureState({ source: "wards", id: sel }, { selected: true });
        // 選択中のラベル減光も新スタイルへ再適用（selectedCode は変化しないため
        // 減光 effect は発火しない）。
        for (const id of labelDimRef.current.ids) {
          map.setPaintProperty(id, "text-opacity", 0.35);
          map.setPaintProperty(id, "icon-opacity", 0.3);
        }
      }
    });
  }, []);

  // サイドパネル余白用：選択中自治体と同県・同階層で家賃中央値が近い上位3件。
  const relatedNearby = useMemo(() => {
    const m = selectedDetail;
    if (!m || !hasRent(m.rent.value)) return [];
    const level = m.level ?? "muni";
    const myRent = m.rent.value;
    return [...municipalities, ...wards]
      .filter((x) => (x.level ?? "muni") === level && x.pref === m.pref && x.code !== m.code && hasRent(x.rent))
      .sort((a, b) => Math.abs(a.rent - myRent) - Math.abs(b.rent - myRent))
      .slice(0, 3);
  }, [selectedDetail, municipalities, wards]);

  const flyToMuni = useCallback(async (m: MuniSummary) => {
    setSelectedCode(m.code);
    trackSelectMunicipality(m.code, "search");
    // 地図初期化前（ヘッダー検索は SSR で先に操作できる）は保留し、初期化完了時に実行。
    if (!ensurePrefsRef.current) { pendingFlyRef.current = m.code; return; }
    // 検索で他県を選んだ場合、その県がまだ遅延ロードされていなければ先に取得
    const pref = getPrefByCode(m.code);
    if (pref) await ensurePrefsRef.current([pref.slug]);
    flyToCode(m.code);
  }, [flyToCode]);

  // パネル開閉はフル詳細の取得完了で判定（取得中の一瞬は閉のまま）
  const rootClass = [
    "map-root",
    selectedDetail && isMobile ? "is-sheet-open" : "",
    selectedDetail && !isMobile ? "is-panel-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      {/* 選択変化のスクリーンリーダー通知（視覚的には非表示）。地図クリック/検索の
          どちらで選んでも、選んだ自治体名が読み上げられる。 */}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      <div
        ref={containerRef}
        className="map-canvas"
        role="region"
        aria-label="日本全国の市区町村を家賃・地価・人口で塗り分けた地図。地図にフォーカスすると矢印キーで移動、＋／−キーで拡大縮小できます。個別の自治体はヘッダーの検索からも選べます。"
      />

      {/* 初期描画用スケルトン地図（LCP 要素）。常時マウントして SSR HTML に含め、
          MapLibre が描画完了したらフェードアウトする。地図は WebGL canvas で
          描かれ canvas は LCP の候補外なので、この <img> が早期に LCP を確定させ、
          LCP が地図初期化(TTI)に張り付くのを防ぐ。素材は scripts/build-initial-view-svg.mjs 生成。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/initial-view.svg"
        alt=""
        aria-hidden="true"
        className={`map-skeleton ${firstPaintReady ? "is-hidden" : ""}`}
      />

      {/* 初回描画までのローディング表示（スケルトンの上に重ねる薄いスピナー） */}
      {!firstPaintReady && (
        <div className="map-loading" aria-hidden="true">
          <div className="map-loading-spinner" />
          <div className="map-loading-text">地図を読み込み中…</div>
        </div>
      )}

      {/* ホバーツールチップ */}
      {tooltip && !isMobile && (
        <div
          className={`map-tooltip ${tooltip.flip ? "is-flipped" : ""}`}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="map-tooltip-name">{tooltip.name}</div>
          {tooltip.value && (
            <div className="map-tooltip-rent">
              {tooltip.label} <strong>{tooltip.value}</strong>
            </div>
          )}
        </div>
      )}

      {/* 統合ヘッダー（固定） */}
      <header className="app-header">
        <div className="app-header-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="brand-mark" width={30} height={30} />
          <div className="brand-name">KurashiMap</div>
        </div>
        <MuniSearch municipalities={municipalities} wards={wards} onSelect={flyToMuni} />
        {onMenuClick && (
          <button
            className="app-header-menu-btn"
            aria-label="エリア・ランキングのメニューを開く"
            onClick={onMenuClick}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="menu-btn-label">エリア・ランキング</span>
          </button>
        )}
      </header>

      {/* 塗り分け指標の切替（地図上のフローティング操作）。サイトナビ（ヘッダーの
          メニュー）と地図コントロールを役割で分け、ヘッダーに混在させない。 */}
      {firstPaintReady && (
        <LayersPanel
          open={layersOpen}
          onToggleOpen={() => setLayersOpen((v) => !v)}
          activeMetric={activeMetric}
          onChangeMetric={changeMetric}
          basemap={basemap}
          onChangeBasemap={switchBasemap}
          overlays={overlays}
          onClearOverlays={() => setOverlays(new Set())}
          onToggleOverlay={toggleOverlay}
          filters={filters}
          onChangeFilters={updateFilters}
          onClearFilters={() => setFilters(EMPTY_FILTERS)}
          filterActive={filterActive}
          matchedCount={matchedCount}
        />
      )}

      {/* 凡例（選択中の指標に追従）。初回描画完了まで出さず「凡例だけ先行」を防ぐ */}
      {firstPaintReady && <MetricLegend metricKey={activeMetric} overlays={overlays} belowHazardZoom={belowHazardZoom} />}

      {/* パネル / シート */}
      {!isMobile ? (
        <AreaPanel municipality={selectedDetail} selectedCode={selectedCode} related={relatedNearby} onClose={() => setSelectedCode(null)} />
      ) : (
        <MobileSheet municipality={selectedDetail} onClose={() => setSelectedCode(null)} />
      )}
    </div>
  );
}
