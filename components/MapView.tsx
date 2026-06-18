"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Municipality } from "@/lib/types";
import { rentStepExpression, RENT_COLORS, RENT_THRESHOLDS } from "@/lib/rentColor";
import AreaPanel from "./AreaPanel";
import MobileSheet from "./MobileSheet";

type Props = { municipalities: Municipality[] };

const GSI_PALE = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const SAITAMA_BBOX: [number, number, number, number] = [138.71, 35.74, 139.91, 36.29];

export default function MapView({ municipalities }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geoCacheRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const hoveredCodeRef = useRef<string | null>(null);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [hazardOn, setHazardOn] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; rent: number } | null>(null);

  const byCode = useMemo(() => {
    const m = new Map<string, Municipality>();
    for (const x of municipalities) m.set(x.code, x);
    return m;
  }, [municipalities]);

  useEffect(() => {
    const detect = () => setIsMobile(window.innerWidth < 768);
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: "raster",
            tiles: [GSI_PALE],
            tileSize: 256,
            maxzoom: 18,
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>',
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#f2f5f8" } },
          { id: "gsi-tiles", type: "raster", source: "gsi", paint: { "raster-opacity": 0.85 } },
        ],
      },
      bounds: SAITAMA_BBOX,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-right");

    map.on("load", async () => {
      const res = await fetch("/saitama.geojson");
      const geo = (await res.json()) as GeoJSON.FeatureCollection;
      // 家賃・ハザード等を properties にマージ（コードでJOIN）
      for (const f of geo.features) {
        const code = String(f.properties?.code ?? "");
        const m = byCode.get(code);
        if (!m) continue;
        f.properties = {
          ...f.properties,
          rent: m.rent.value,
          name: m.name,
          hasFloodRisk: m.hazard.hasFloodRisk ? 1 : 0,
        };
      }
      geoCacheRef.current = geo;

      map.addSource("muni", { type: "geojson", data: geo, promoteId: "code" });

      // 家賃コロプレス（ベース）
      map.addLayer({
        id: "muni-fill",
        type: "fill",
        source: "muni",
        paint: {
          "fill-color": rentStepExpression() as maplibregl.DataDrivenPropertyValueSpecification<string>,
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false], 0.95,
            ["boolean", ["feature-state", "selected"], false], 0.95,
            0.75,
          ],
        },
      });
      // 境界線
      map.addLayer({
        id: "muni-outline",
        type: "line",
        source: "muni",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#0b2545",
            "#ffffff",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 3,
            ["boolean", ["feature-state", "hover"], false], 1.6,
            0.7,
          ],
          "line-opacity": 0.85,
        },
      });
      // 災害リスク オーバーレイ
      map.addLayer({
        id: "muni-hazard",
        type: "fill",
        source: "muni",
        filter: ["==", ["get", "hasFloodRisk"], 1],
        paint: {
          "fill-color": "#1d4ed8",
          "fill-opacity": 0.18,
        },
      });

      map.on("click", "muni-fill", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelectedCode(String(f.properties?.code ?? ""));
      });

      map.on("mousemove", "muni-fill", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const code = String(f.properties?.code ?? "");
        if (hoveredCodeRef.current && hoveredCodeRef.current !== code) {
          map.setFeatureState({ source: "muni", id: hoveredCodeRef.current }, { hover: false });
        }
        hoveredCodeRef.current = code;
        map.setFeatureState({ source: "muni", id: code }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          name: String(f.properties?.name ?? ""),
          rent: Number(f.properties?.rent ?? 0),
        });
      });
      map.on("mouseleave", "muni-fill", () => {
        if (hoveredCodeRef.current) {
          map.setFeatureState({ source: "muni", id: hoveredCodeRef.current }, { hover: false });
          hoveredCodeRef.current = null;
        }
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [byCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty("muni-hazard", "visibility", hazardOn ? "visible" : "none");
  }, [hazardOn, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    municipalities.forEach((m) => {
      map.setFeatureState({ source: "muni", id: m.code }, { selected: m.code === selectedCode });
    });
  }, [selectedCode, mapReady, municipalities]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return municipalities.filter((m) => m.name.includes(q)).slice(0, 8);
  }, [searchQuery, municipalities]);

  const flyToMuni = useCallback((m: Municipality) => {
    const map = mapRef.current;
    if (!map) return;
    const geo = geoCacheRef.current;
    if (!geo) return;
    const feat = geo.features.find((x) => String(x.properties?.code) === m.code);
    if (!feat) return;
    const bbox = computeBbox(feat.geometry);
    if (!bbox) return;
    map.fitBounds(bbox, { padding: 80, maxZoom: 12, duration: 900 });
    setSelectedCode(m.code);
    setSearchQuery("");
  }, []);

  const selected = selectedCode ? byCode.get(selectedCode) ?? null : null;

  return (
    <div className="map-root">
      <div ref={containerRef} className="map-canvas" />

      {/* ホバーツールチップ */}
      {tooltip && !isMobile && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="map-tooltip-name">{tooltip.name}</div>
          <div className="map-tooltip-rent">
            家賃 <strong>{tooltip.rent.toLocaleString()}</strong> 円/月
          </div>
        </div>
      )}

      {/* ヘッダーバッジ */}
      <header className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-title">MachiMap</div>
          <div className="brand-sub">埼玉県（β・サンプルデータ）</div>
        </div>
      </header>

      {/* 検索 */}
      <div className="search">
        <div className="search-input-wrap">
          <SearchIcon />
          <input
            type="search"
            placeholder="自治体名で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="自治体検索"
          />
        </div>
        {filtered.length > 0 && (
          <ul className="search-results">
            {filtered.map((m) => (
              <li key={m.code}>
                <button onClick={() => flyToMuni(m)}>
                  <span>{m.name}</span>
                  <span className="search-rent">{m.rent.value.toLocaleString()}円</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* レイヤートグル */}
      <div className={`layers ${selected && !isMobile ? "layers-with-panel" : ""}`}>
        <div className="layers-title">表示レイヤー</div>
        <LayerToggle label="家賃コロプレス" checked disabled />
        <LayerToggle label="災害リスク" checked={hazardOn} onChange={setHazardOn} />
      </div>

      {/* 凡例 */}
      <div className="legend">
        <div className="legend-title">民営借家中央値（円/月）</div>
        <div className="legend-bar">
          {RENT_COLORS.map((c) => (
            <div key={c} className="legend-cell" style={{ background: c }} />
          ))}
        </div>
        <div className="legend-scale">
          <span>～5万</span>
          {RENT_THRESHOLDS.slice(1, -1).map((t) => (
            <span key={t}>{t / 10000}万</span>
          ))}
          <span>6.5万～</span>
        </div>
      </div>

      {/* パネル / シート */}
      {!isMobile ? (
        <AreaPanel municipality={selected} onClose={() => setSelectedCode(null)} />
      ) : (
        <MobileSheet municipality={selected} onClose={() => setSelectedCode(null)} />
      )}
    </div>
  );
}

function LayerToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`layer-toggle ${disabled ? "is-disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="layer-switch" />
      <span className="layer-label">{label}</span>
    </label>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function computeBbox(geom: GeoJSON.Geometry): [[number, number], [number, number]] | null {
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
