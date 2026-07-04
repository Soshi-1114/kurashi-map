"use client";

// 地図上のフローティング操作パネル（塗り分け指標・ベース地図・ハザードマップ・絞り込み）。
// 状態は持たず、すべて props 経由（状態の単一ソースは MapView）。
import { MAP_METRICS, getMapMetric, type MapMetricKey } from "@/lib/mapMetrics";
import {
  RENT_MAX_OPTIONS, LAND_MAX_OPTIONS, FLOOD_MAX_OPTIONS, type MapFilters,
} from "@/lib/mapFilters";
import { HAZARD_OVERLAYS } from "@/lib/mapHazards";
import { BASEMAPS, type BasemapKey } from "@/lib/mapBasemaps";
import { SHELTER_KEY, type OverlayKey } from "./mapConstants";

type Props = {
  open: boolean;
  onToggleOpen: () => void;
  activeMetric: MapMetricKey | "none";
  onChangeMetric: (key: MapMetricKey | "none") => void;
  basemap: BasemapKey;
  onChangeBasemap: (key: BasemapKey) => void;
  overlays: Set<OverlayKey>;
  onClearOverlays: () => void;
  onToggleOverlay: (key: OverlayKey) => void;
  filters: MapFilters;
  onChangeFilters: (next: MapFilters) => void;
  onClearFilters: () => void;
  filterActive: boolean;
  matchedCount: number;
};

export default function LayersPanel({
  open, onToggleOpen,
  activeMetric, onChangeMetric,
  basemap, onChangeBasemap,
  overlays, onClearOverlays, onToggleOverlay,
  filters, onChangeFilters, onClearFilters,
  filterActive, matchedCount,
}: Props) {
  return (
    <div className={`map-layers ${open ? "is-open" : ""}`}>
      <button
        className={`map-layers-btn map-layers-btn-icon ${open ? "is-active" : ""}`}
        aria-label="地図の表示設定（塗り分け・ハザードマップ・絞り込み）を開閉"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <LayersIcon />
      </button>
      {open && (
        <div className="layers-panel">
          <div className="layers-title">塗り分け指標</div>
          <div className="metric-radios" role="radiogroup" aria-label="塗り分け指標">
            {MAP_METRICS.map((m) => (
              <label key={m.key} className={`metric-radio ${activeMetric === m.key ? "is-active" : ""}`}>
                <input
                  type="radio"
                  name="map-metric"
                  checked={activeMetric === m.key}
                  onChange={() => onChangeMetric(m.key)}
                />
                <span className="metric-radio-label">{m.label}</span>
              </label>
            ))}
            {/* 塗り分けなし（地図とオーバーレイだけ見たい時） */}
            <label className={`metric-radio ${activeMetric === "none" ? "is-active" : ""}`}>
              <input
                type="radio"
                name="map-metric"
                checked={activeMetric === "none"}
                onChange={() => onChangeMetric("none")}
              />
              <span className="metric-radio-label">なし</span>
            </label>
          </div>
          {/* 選択中の指標が「何の色か」を1行で説明（出典つき）。初見の文脈不足を補う */}
          <p className="layers-desc">
            {activeMetric === "none"
              ? "自治体は塗り分けません（地図・ハザードマップのみ）。"
              : getMapMetric(activeMetric).description}
          </p>

          <div className="layers-title layers-title-sub">地図</div>
          <div className="filter-row">
            <div className="filter-segments" role="radiogroup" aria-label="地図スタイル">
              {BASEMAPS.map((b) => (
                <button
                  key={b.key}
                  className={`filter-seg ${basemap === b.key ? "is-active" : ""}`}
                  aria-pressed={basemap === b.key}
                  onClick={() => onChangeBasemap(b.key)}
                >{b.label}</button>
              ))}
            </div>
          </div>

          <div className="layers-title layers-title-sub">ハザードマップ</div>
          <div className="filter-row">
            <div className="filter-segments" role="group" aria-label="ハザードマップ">
              <button
                className={`filter-seg ${overlays.size === 0 ? "is-active" : ""}`}
                aria-pressed={overlays.size === 0}
                onClick={onClearOverlays}
              >なし</button>
              {HAZARD_OVERLAYS.map((h) => (
                <button
                  key={h.key}
                  className={`filter-seg ${overlays.has(h.key) ? "is-active" : ""}`}
                  aria-pressed={overlays.has(h.key)}
                  onClick={() => onToggleOverlay(h.key)}
                >{h.label}</button>
              ))}
              <button
                className={`filter-seg ${overlays.has(SHELTER_KEY) ? "is-active" : ""}`}
                aria-pressed={overlays.has(SHELTER_KEY)}
                onClick={() => onToggleOverlay(SHELTER_KEY)}
              >避難所</button>
            </div>
          </div>

          <div className="layers-title layers-title-sub">絞り込み</div>
          <SegmentedFilter
            label="家賃上限"
            options={RENT_MAX_OPTIONS}
            value={filters.rentMax}
            onChange={(v) => onChangeFilters({ ...filters, rentMax: v })}
          />
          <SegmentedFilter
            label="地価上限"
            options={LAND_MAX_OPTIONS}
            value={filters.landMax}
            onChange={(v) => onChangeFilters({ ...filters, landMax: v })}
          />
          <SegmentedFilter
            label="浸水深上限"
            options={FLOOD_MAX_OPTIONS}
            value={filters.floodMax}
            onChange={(v) => onChangeFilters({ ...filters, floodMax: v })}
          />
          {filterActive && (
            <div className="filter-summary" aria-live="polite">
              <span className="filter-count">
                全国該当 <strong>{matchedCount.toLocaleString()}</strong> 自治体
                <span className="filter-count-note">（データなしの自治体は除外）</span>
              </span>
              <button className="filter-clear" onClick={onClearFilters}>クリア</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LayersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function SegmentedFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; value: number }[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="filter-row">
      <span className="filter-row-label">{label}</span>
      <div className="filter-segments" role="group" aria-label={label}>
        <button
          className={`filter-seg ${value == null ? "is-active" : ""}`}
          aria-pressed={value == null}
          onClick={() => onChange(null)}
        >
          なし
        </button>
        {options.map((o) => (
          <button
            key={o.value}
            className={`filter-seg ${value === o.value ? "is-active" : ""}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
