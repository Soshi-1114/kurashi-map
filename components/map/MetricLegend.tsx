"use client";

// 地図の凡例。選択中の塗り分け指標と災害オーバーレイに追従する。
import { RENT_NODATA_COLOR } from "@/lib/rentColor";
import { getMapMetric, type MapMetricKey } from "@/lib/mapMetrics";
import { HAZARD_OVERLAYS, isInundationKey } from "@/lib/mapHazards";
import { SHELTER_KEY, type OverlayKey } from "./mapConstants";

// 国（国交省）「浸水深（想定最大規模）」の段彩。浸水・津波・高潮の公式ラスタはこの
// 共通スケールで描かれる。セル境界は 0.5/3/5/10/20m（DEPTH_BOUNDARIES）。
const DEPTH_COLORS = ["#F7F5A9", "#FFD8C0", "#FFB7B7", "#FF9191", "#F285C9", "#B186E0"];
const DEPTH_BOUNDARIES = ["0.5", "3", "5", "10", "20"]; // m（6セルの内側境界）
// 土砂災害警戒区域: 警戒（イエローゾーン）/ 特別警戒（レッドゾーン）。
const LANDSLIDE_WARN = "#f2d11b";
const LANDSLIDE_SPECIAL = "#e8331f";
const SHELTER_LEGEND_COLOR = "#0f9d58";

export default function MetricLegend({ metricKey, overlays, belowHazardZoom }: { metricKey: MapMetricKey | "none"; overlays: Set<OverlayKey>; belowHazardZoom: boolean }) {
  const activeHazards = HAZARD_OVERLAYS.filter((h) => overlays.has(h.key));
  const showShelter = overlays.has(SHELTER_KEY);
  const hasOverlay = activeHazards.length > 0 || showShelter;
  // 浸水系は排他選択なので最大1種。土砂は別配色で併用可、避難所は緑の点。
  const inundation = activeHazards.find((h) => isInundationKey(h.key));
  const showLandslide = overlays.has("landslide");
  // 災害種別は実区域ラスタが出る閾値（HAZARD_ZONE_ZOOM）以上でのみ地図に描かれるので、
  // 閾値未満では凡例の代わりにズーム誘導を出す。凡例は地図の実際の配色に合わせる:
  // 浸水/津波/高潮=国の「浸水深」段彩、土砂=警戒/特別警戒の2色、避難所=緑点。
  const overlayLegend = hasOverlay ? (
    <>
      {activeHazards.length > 0 && (
        belowHazardZoom ? (
          <div className="legend-overlay-note">
            ズームすると災害リスク区域（{activeHazards.map((h) => h.label).join("・")}）を表示します
          </div>
        ) : (
          <>
            {inundation && (
              <div className="legend-overlay-group">
                <div className="legend-overlay-title">{inundation.legend}</div>
                <div className="legend-bar">
                  {DEPTH_COLORS.map((c) => (
                    <div key={c} className="legend-cell" style={{ background: c }} />
                  ))}
                </div>
                <div className="legend-scale">
                  {DEPTH_BOUNDARIES.map((s, i) => (
                    <span key={s} style={{ left: `${((i + 1) * 100) / DEPTH_COLORS.length}%` }}>{s}</span>
                  ))}
                </div>
                <div className="legend-overlay-note">単位 m ／ 浸水・津波・高潮は国の同一スケール</div>
              </div>
            )}
            {showLandslide && (
              <div className="legend-overlay-group">
                <div className="legend-overlay-title">土砂災害警戒区域</div>
                <div className="legend-overlay">
                  <span className="legend-cell" style={{ background: LANDSLIDE_WARN }} />警戒区域
                </div>
                <div className="legend-overlay">
                  <span className="legend-cell" style={{ background: LANDSLIDE_SPECIAL }} />特別警戒区域
                </div>
              </div>
            )}
          </>
        )
      )}
      {showShelter && (
        <div className="legend-overlay">
          <span className="legend-cell" style={{ background: SHELTER_LEGEND_COLOR }} />
          指定緊急避難場所{activeHazards.length > 0 ? "（選択中の災害に有効な場所）" : ""}
        </div>
      )}
    </>
  ) : null;

  // 塗り分け「なし」: コロプレス凡例は出さず、オーバーレイを選んでいればその凡例だけ出す。
  if (metricKey === "none") {
    if (!hasOverlay) return null;
    return <div className="legend">{overlayLegend}</div>;
  }
  const metric = getMapMetric(metricKey);
  const { legend } = metric;
  return (
    <div className="legend">
      <div className="legend-eyebrow">塗り分け中</div>
      <div className="legend-title">{metric.legendTitle}</div>
      {legend.kind === "numeric" ? (
        <>
          <div className="legend-bar">
            {legend.colors.map((c) => (
              <div key={c} className="legend-cell" style={{ background: c }} />
            ))}
          </div>
          {/* 4つの境界ラベルを5セルの境界（20/40/60/80%）に整列。
              space-between だと境界とラベル位置がずれて区切り値が曖昧になる。 */}
          <div className="legend-scale">
            {legend.scaleLabels.map((s, i) => (
              <span key={s} style={{ left: `${((i + 1) * 100) / legend.colors.length}%` }}>{s}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="legend-cats">
          {legend.items.map((it) => (
            <div key={it.label} className="legend-cat">
              <span className="legend-cell" style={{ background: it.color }} />
              {it.label}
            </div>
          ))}
        </div>
      )}
      <div className="legend-nodata">
        <span className="legend-cell" style={{ background: RENT_NODATA_COLOR }} />
        {metric.nodataLabel}
      </div>
      {overlayLegend}
    </div>
  );
}
