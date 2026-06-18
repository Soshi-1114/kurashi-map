"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Municipality } from "@/lib/types";
import { rentStepExpression } from "@/lib/rentColor";
import AreaPanel from "./AreaPanel";
import MobileSheet from "./MobileSheet";

type Props = { municipalities: Municipality[] };

const GSI_TILES = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";

export default function MapView({ municipalities }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [hazardOn, setHazardOn] = useState(true);
  const [facilitiesOn, setFacilitiesOn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapReady, setMapReady] = useState(false);

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

  // Map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: "raster",
            tiles: [GSI_TILES],
            tileSize: 256,
            attribution: '出典：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">国土地理院</a>',
          },
        },
        layers: [{ id: "gsi-tiles", type: "raster", source: "gsi" }],
      },
      center: [139.65, 35.95],
      zoom: 9.2,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
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

      map.addSource("muni", { type: "geojson", data: geo, promoteId: "code" });

      // 家賃コロプレス（ベース・常時）
      map.addLayer({
        id: "muni-fill",
        type: "fill",
        source: "muni",
        paint: {
          "fill-color": rentStepExpression() as maplibregl.DataDrivenPropertyValueSpecification<string>,
          "fill-opacity": 0.85,
        },
      });
      // 境界線
      map.addLayer({
        id: "muni-outline",
        type: "line",
        source: "muni",
        paint: {
          "line-color": "#333",
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            3,
            0.5,
          ],
        },
      });
      // 災害リスク オーバーレイ（薄い青）
      map.addLayer({
        id: "muni-hazard",
        type: "fill",
        source: "muni",
        filter: ["==", ["get", "hasFloodRisk"], 1],
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.25,
        },
      });

      // クリック選択
      map.on("click", "muni-fill", (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const code = String(f.properties?.code ?? "");
        setSelectedCode(code);
      });
      map.on("mouseenter", "muni-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "muni-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [byCode]);

  // ハザードON時はコロプレスの fill-opacity を下げる
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty("muni-hazard", "visibility", hazardOn ? "visible" : "none");
    map.setPaintProperty("muni-fill", "fill-opacity", hazardOn ? 0.55 : 0.85);
  }, [hazardOn, mapReady]);

  // 選択状態の feature-state 更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    municipalities.forEach((m) => {
      map.setFeatureState({ source: "muni", id: m.code }, { selected: m.code === selectedCode });
    });
  }, [selectedCode, mapReady, municipalities]);

  const filtered = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.trim();
    if (!q) return [];
    return municipalities.filter((m) => m.name.includes(q)).slice(0, 8);
  }, [searchQuery, municipalities]);

  const flyToMuni = (m: Municipality) => {
    const map = mapRef.current;
    if (!map) return;
    const f = (map.getSource("muni") as maplibregl.GeoJSONSource | undefined);
    if (!f) return;
    // GeoJSONからbboxを計算
    fetch("/saitama.geojson")
      .then((r) => r.json())
      .then((geo: GeoJSON.FeatureCollection) => {
        const feat = geo.features.find((x) => String(x.properties?.code) === m.code);
        if (!feat || feat.geometry.type !== "Polygon") return;
        const coords = feat.geometry.coordinates[0] as number[][];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of coords) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 60, maxZoom: 12, duration: 800 });
      });
    setSelectedCode(m.code);
    setSearchQuery("");
  };

  const selected = selectedCode ? byCode.get(selectedCode) ?? null : null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* 検索ボックス */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          width: isMobile ? "calc(100% - 24px)" : 280,
          zIndex: 5,
        }}
      >
        <input
          type="search"
          placeholder="自治体名で検索（例: 川口）"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid #ccd2d8",
            background: "#fff",
            fontSize: 14,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        />
        {filtered.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: "4px 0 0",
              padding: 0,
              background: "#fff",
              border: "1px solid #ccd2d8",
              borderRadius: 6,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
          >
            {filtered.map((m) => (
              <li key={m.code}>
                <button
                  onClick={() => flyToMuni(m)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* レイヤートグル */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: isMobile ? 12 : selected ? 380 : 12,
          background: "#fff",
          padding: "10px 12px",
          borderRadius: 6,
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          fontSize: 13,
          zIndex: 5,
        }}
      >
        <div style={{ marginBottom: 4, fontWeight: 600, color: "#333" }}>レイヤー</div>
        <label style={{ display: "block", marginBottom: 4, color: "#444" }}>
          <input type="checkbox" checked disabled style={{ marginRight: 6 }} />
          家賃（基本）
        </label>
        <label style={{ display: "block", marginBottom: 4, color: "#444" }}>
          <input
            type="checkbox"
            checked={hazardOn}
            onChange={(e) => setHazardOn(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          災害リスク
        </label>
        <label style={{ display: "block", color: "#444" }}>
          <input
            type="checkbox"
            checked={facilitiesOn}
            onChange={(e) => setFacilitiesOn(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          地価・施設（仮）
        </label>
      </div>

      {/* 凡例 */}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          background: "rgba(255,255,255,0.94)",
          padding: "8px 10px",
          borderRadius: 6,
          fontSize: 11,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          zIndex: 4,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>家賃 中央値（円/月）</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {["#dbe7f0", "#a7c4dc", "#6f9bc4", "#3f72a6", "#1f4d7a"].map((c) => (
            <div key={c} style={{ width: 22, height: 12, background: c }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, color: "#555" }}>
          <span>～5万</span>
          <span>6.5万～</span>
        </div>
      </div>

      {/* PCサイドパネル / SP下部シート */}
      {!isMobile ? (
        <AreaPanel municipality={selected} onClose={() => setSelectedCode(null)} />
      ) : (
        <MobileSheet municipality={selected} onClose={() => setSelectedCode(null)} />
      )}
    </div>
  );
}
