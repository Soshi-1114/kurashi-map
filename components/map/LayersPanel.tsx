"use client";

// 地図上の操作パネル（塗り分け指標・ベース地図・ハザードマップ・絞り込み）。
// 状態は持たず、すべて props 経由（状態の単一ソースは MapView）。
// 表示形態は2通り: PC は地図右上のポップオーバー、モバイル（isMobile）は
// 画面下から開くモーダルの Bottom Sheet（scrim・ESC・スクロールロック・フォーカス移動つき）。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAP_METRICS, getMapMetric, type MapMetricKey } from "@/lib/mapMetrics";
import {
  RENT_MAX_OPTIONS, LAND_MAX_OPTIONS, FLOOD_MAX_OPTIONS,
  VACANCY_MAX_OPTIONS, FUTURE_MIN_OPTIONS, type MapFilters,
} from "@/lib/mapFilters";
import { HAZARD_OVERLAYS } from "@/lib/mapHazards";
import { BASEMAPS, type BasemapKey } from "@/lib/mapBasemaps";
import { PREFS } from "@/lib/prefs";
import type { MuniSummary } from "@/lib/types";
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
  /** フィルタ該当の自治体（matchesFilter と同一条件で MapView が算出）。一覧表示用 */
  matchedMunis: MuniSummary[];
  /** 該当一覧から自治体を選んだ時（地図フライト＋詳細パネル表示は MapView 側） */
  onSelectMatch: (code: string) => void;
  /** モバイル表示（MapView の isMobile と連動。true で Bottom Sheet 化） */
  isMobile?: boolean;
  /** 既定値から変更されている設定の数（>0 でトグルボタンにバッジ表示） */
  activeCount?: number;
};

export default function LayersPanel({
  open, onToggleOpen,
  activeMetric, onChangeMetric,
  basemap, onChangeBasemap,
  overlays, onClearOverlays, onToggleOverlay,
  filters, onChangeFilters, onClearFilters,
  filterActive, matchedCount, matchedMunis, onSelectMatch,
  isMobile = false,
  activeCount = 0,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  // 該当一覧の開閉（パネル内のビュー状態なのでローカルに持つ）。
  // フィルタを全解除すると filter-summary ごと消えるため、明示リセットは不要。
  const [showMatches, setShowMatches] = useState(false);

  // Escape で閉じる（PC/モバイル共通）。モバイルはモーダルなので加えて
  // body スクロールをロックし、開いた直後に閉じるボタンへフォーカスを移す。
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggleOpen();
        return;
      }
      // モバイルのみ: シート内で Tab をループさせる軽量フォーカストラップ
      if (isMobile && e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    let unlock: (() => void) | undefined;
    if (isMobile) {
      // html を overflow:hidden にするだけだとルートスクローラの位置が 0 に落ちる。
      // scrim は半透明なので、背後のページがページ先頭へ飛ぶのがそのまま見えるうえ、
      // 解除しても位置が戻らない（地図まで下スクロール→開く→閉じたら先頭）。
      // body を現在位置ぶん引き上げて固定すれば、見た目は据え置きのまま
      // スクロールだけ止まる（iOS Safari でも効く定番手）。
      const docEl = document.documentElement;
      const body = document.body;
      const prevScrollY = window.scrollY;
      const prevDocOverflow = docEl.style.overflow;
      const prevBody = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
      };
      body.style.position = "fixed";
      body.style.top = `-${prevScrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      docEl.style.overflow = "hidden";
      unlock = () => {
        docEl.style.overflow = prevDocOverflow;
        body.style.position = prevBody.position;
        body.style.top = prevBody.top;
        body.style.left = prevBody.left;
        body.style.right = prevBody.right;
        body.style.width = prevBody.width;
        body.style.overflow = prevBody.overflow;
        window.scrollTo(0, prevScrollY);
      };
      // フォーカス移動でスクロールが動かないようにする
      closeBtnRef.current?.focus({ preventScroll: true });
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlock?.();
    };
  }, [open, isMobile, onToggleOpen]);

  const body = (
    <>
      {/* モバイルのみ表示される背面オーバーレイ（タップで閉じる） */}
      <div className="layers-scrim" onClick={onToggleOpen} aria-hidden="true" />
          <div
            ref={panelRef}
            className="layers-panel"
            {...(isMobile ? { role: "dialog", "aria-modal": true, "aria-label": "地図の表示設定" } : {})}
          >
            {/* モバイルのみ表示されるシートヘッダー（タイトル＋明示的な閉じるボタン） */}
            <div className="layers-head">
              <span className="layers-head-title">地図の表示設定</span>
              <button
                ref={closeBtnRef}
                type="button"
                className="layers-head-close"
                aria-label="閉じる"
                onClick={onToggleOpen}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
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
          <SegmentedFilter
            label="空き家率上限"
            options={VACANCY_MAX_OPTIONS}
            value={filters.vacancyMax}
            onChange={(v) => onChangeFilters({ ...filters, vacancyMax: v })}
          />
          <SegmentedFilter
            label="2050年人口（推計）"
            options={FUTURE_MIN_OPTIONS}
            value={filters.futureMin}
            onChange={(v) => onChangeFilters({ ...filters, futureMin: v })}
          />
          {filterActive && (
            <>
              <div className="filter-summary" aria-live="polite">
                <span className="filter-count">
                  全国該当 <strong>{matchedCount.toLocaleString()}</strong> 自治体
                  <span className="filter-count-note">（データなしの自治体は除外）</span>
                </span>
                {matchedCount > 0 && (
                  <button
                    className="filter-clear"
                    aria-expanded={showMatches}
                    onClick={() => setShowMatches((v) => !v)}
                  >
                    {showMatches ? "一覧を閉じる" : "一覧を見る"}
                  </button>
                )}
                <button className="filter-clear" onClick={onClearFilters}>クリア</button>
              </div>
              {showMatches && matchedCount > 0 && (
                <MatchedList
                  munis={matchedMunis}
                  onSelect={(code) => {
                    onSelectMatch(code);
                    // モバイルはシートが地図を覆うため、選択したら閉じて結果を見せる
                    if (isMobile) onToggleOpen();
                  }}
                />
              )}
            </>
          )}
      </div>
    </>
  );

  return (
    <div className="map-layers">
      <button
        className={`map-layers-btn map-layers-btn-icon ${open ? "is-active" : ""}`}
        aria-label={`地図の表示設定（塗り分け・ハザードマップ・絞り込み）を開閉${activeCount > 0 ? `（設定${activeCount}件適用中）` : ""}`}
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <LayersIcon />
        {activeCount > 0 && (
          <span className="map-layers-badge" aria-hidden="true">{activeCount}</span>
        )}
      </button>
      {/* モバイルのシートは body 直下へ portal する。地図コンテナ（埋め込み時は
          overflow:hidden）の内側に置くと、iOS WebKit では position:fixed の子が
          その overflow で切り取られ、scrim と閉じるボタンが画面外に消えて
          「開いたら閉じられない」状態になるため。PC のポップオーバーは
          .map-layers を基準に配置するので、その場に残す。 */}
      {open && (isMobile
        ? createPortal(<div className="layers-sheet">{body}</div>, document.body)
        : body)}
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

// フィルタ該当自治体の一覧（都道府県ごとにグループ化。PREFS の並び順＝北→南）。
// 行クリックで地図フライト＋詳細パネル表示（MapView の検索確定と同じ経路）。
function MatchedList({ munis, onSelect }: { munis: MuniSummary[]; onSelect: (code: string) => void }) {
  const byPref = new Map<string, MuniSummary[]>();
  for (const m of munis) {
    const list = byPref.get(m.pref);
    if (list) list.push(m);
    else byPref.set(m.pref, [m]);
  }
  return (
    <div className="filter-matches">
      {PREFS.map((p) => {
        const list = byPref.get(p.slug);
        if (!list) return null;
        return (
          <div key={p.slug} className="filter-matches-group">
            <div className="filter-matches-pref">
              {p.nameJa}
              <span className="filter-matches-count">{list.length}</span>
            </div>
            <ul className="filter-matches-list">
              {list.map((m) => (
                <li key={m.code}>
                  <button type="button" className="filter-matches-item" onClick={() => onSelect(m.code)}>
                    {m.displayName ?? m.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
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
