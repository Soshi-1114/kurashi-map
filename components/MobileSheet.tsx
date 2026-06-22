"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Municipality } from "@/lib/types";
import { buildSummary } from "@/lib/summary";
import { hasRent } from "@/lib/rentColor";
import { MetricCards } from "./AreaPanel";

type Stage = "peek" | "half" | "full";

type Props = {
  municipality: Municipality | null;
  onClose: () => void;
};

// 3段ボトムシート: peek=最小化(地図優先) / half=主要指標(既定) / full=全情報(モーダル)。
// シート高は full 固定にして transform: translateY で段を切替える。height アニメと違い
// ドラッグ中の再レイアウトが無く GPU 合成で滑らか（旧実装の height 駆動を置換）。
const STAGE_ORDER: readonly Stage[] = ["peek", "half", "full"];
const PEEK_PX = 96;   // ハンドル＋自治体名＋家賃の1行が収まる高さ
// half の高さは「自治体名＋指標カード」の実コンテンツ高に合わせて実測する（余白を出さない）。
// これは計測前の初期値で、実測値（halfPx state）が入るまでのフォールバック。
const HALF_PX_FALLBACK = 236;
// half がコンテンツ実測で画面を占有しすぎないための上限（画面高に対する比）。
// full=72% より十分小さく、地図の文脈を残す。
const HALF_MAX_RATIO = 0.62;
const SHEET_HEIGHT = "calc(72vh + env(safe-area-inset-bottom))"; // 固定高（=full）

// シート箱の実ピクセル高（translate 計算の基準）。CSS の 72vh は iOS で
// window.innerHeight と一致しない（URLバー）。translate を innerHeight 基準で
// 計算すると可視高が CSS箱高とズレてカードが見切れるため、実測 offsetHeight を
// 基準にする。未計測時のみ innerHeight×0.72 にフォールバック。
function fallbackSheetPx(): number {
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  return Math.round(h * 0.72);
}
// 各段の「可視高（=シート上端から見える高さ）」。full は箱全体。
function stageVisiblePx(stage: Stage, halfPx: number, sheetPx: number): number {
  if (stage === "peek") return PEEK_PX;
  if (stage === "half") return halfPx;
  return sheetPx;
}
// 段ごとの translateY（0=full 全表示, 値が大きいほど下に隠れる）。
// 可視高 = sheetPx − translate なので translate = sheetPx − 目標可視高。
function stageTranslate(stage: Stage, halfPx: number, sheetPx: number): number {
  return sheetPx - stageVisiblePx(stage, halfPx, sheetPx);
}
export default function MobileSheet({ municipality, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("half");
  // ドラッグ中の translateY（null = 非ドラッグ）
  const [dragY, setDragY] = useState<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartTranslate = useRef(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const halfContentRef = useRef<HTMLDivElement | null>(null);
  // half 段の高さ（実測）。「自治体名＋指標カード」がちょうど収まる高さに合わせる。
  const [halfPx, setHalfPx] = useState(HALF_PX_FALLBACK);
  // シート箱の実高（72vh の解決値）。translate 計算の基準。未計測時は null。
  const [sheetPx, setSheetPx] = useState<number | null>(null);
  const sheetBasis = sheetPx ?? fallbackSheetPx();

  // 新規選択で half に戻す
  useEffect(() => {
    setStage("half");
    setDragY(null);
  }, [municipality?.code]);

  // シート箱高（sheetPx）と half 段高（halfPx）を実測する。
  // ・sheetPx: シートの offsetHeight（72vh の実解決値）。translate 基準を innerHeight でなく
  //   これにすることで CSS箱高と可視高がズレず、カードの見切れを防ぐ。
  // ・halfPx: 指標カード下端＋下パディング。「名称＋カード」がちょうど見える高さ。カードは
  //   固定 px 高なので本質的にコンテンツ依存（画面比だけだと高い端末で余白・低い端末で見切れ）。
  //   ただし極端に低い端末で地図が潰れないよう画面比の上限（HALF_MAX_RATIO）でクランプする。
  useEffect(() => {
    if (!municipality) return;
    const measure = () => {
      const sh = sheetRef.current?.offsetHeight;
      if (sh) setSheetPx(sh);
      const el = halfContentRef.current;
      if (el && stage !== "peek") {
        const content = el.offsetTop + el.offsetHeight + 20;
        const cap = Math.round(window.innerHeight * HALF_MAX_RATIO);
        setHalfPx(Math.min(Math.round(content), cap));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [municipality?.code, stage]);

  // 凡例・地図コントロール・レイヤーパネルが現在の可視シート高に追従できるよう、
  // 祖先 .map-root に CSS変数 --sheet-h を書き込む（CSS は calc(var(--sheet-h)+…) で読む）。
  // シートは height 固定（vh基準）＋ transform で段を切替えるが、iOS では CSS の vh と
  // window.innerHeight が URLバーぶんズレるため、calc 文字列ではなく実測 px を流す:
  // 可視高 = シートの実 offsetHeight − 適用中の translateY（どちらも単位非依存で厳密）。
  useEffect(() => {
    const root = document.querySelector(".map-root") as HTMLElement | null;
    if (!root) return;
    if (!municipality) {
      root.style.removeProperty("--sheet-h");
      return;
    }
    const apply = () => {
      const sh = sheetRef.current?.offsetHeight ?? fallbackSheetPx();
      const visible = Math.max(0, sh - stageTranslate(stage, halfPx, sh));
      root.style.setProperty("--sheet-h", `${Math.round(visible)}px`);
    };
    apply();
    // 回転・URLバー開閉で実寸が変わるため再計測
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--sheet-h");
    };
  }, [stage, municipality, halfPx]);

  if (!municipality) return null;
  const m = municipality;

  // タップ: peek→half→full→half（peek へはドラッグで畳む）
  const toggle = () =>
    setStage((s) => (s === "full" ? "half" : s === "half" ? "full" : "half"));
  const collapse = () => setStage("half");

  const maxTranslate = () => sheetBasis - PEEK_PX; // peek が最も下

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartTranslate.current = stageTranslate(stage, halfPx, sheetBasis);
    setDragY(stageTranslate(stage, halfPx, sheetBasis));
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    // peek 未満 / full 超にクランプ
    const t = Math.max(0, Math.min(maxTranslate(), dragStartTranslate.current + dy));
    setDragY(t);
  };
  const onTouchEnd = () => {
    if (dragStartY.current === null) return;
    const live = dragY ?? stageTranslate(stage, halfPx, sheetBasis);
    // 最近傍の段へスナップ
    let target = STAGE_ORDER.reduce<Stage>(
      (best, s) =>
        Math.abs(stageTranslate(s, halfPx, sheetBasis) - live) < Math.abs(stageTranslate(best, halfPx, sheetBasis) - live)
          ? s
          : best,
      STAGE_ORDER[0],
    );
    // フリック補正: 同段に戻る小スワイプでも明確な方向には1段送る
    const moved = live - stageTranslate(stage, halfPx, sheetBasis); // +下方向 / -上方向
    const FLICK = 56;
    if (target === stage) {
      const idx = STAGE_ORDER.indexOf(stage);
      if (moved > FLICK && idx > 0) target = STAGE_ORDER[idx - 1];
      else if (moved < -FLICK && idx < STAGE_ORDER.length - 1) target = STAGE_ORDER[idx + 1];
    }
    setStage(target);
    setDragY(null);
    dragStartY.current = null;
  };

  const heading = m.displayName ?? m.name;

  const translate = dragY !== null ? dragY : stageTranslate(stage, halfPx, sheetBasis);
  const dragging = dragY !== null;

  // scrim は full 付近のみ。full(translate=0)→half へ離れるほど薄くなる。
  const halfT = stageTranslate("half", halfPx, sheetBasis);
  const scrimIntensity = halfT > 0 ? Math.max(0, Math.min(1, 1 - translate / halfT)) : 0;

  return (
    <>
      {scrimIntensity > 0.01 && (
        <div
          className="sheet-scrim"
          aria-hidden="true"
          onClick={collapse}
          style={{ opacity: scrimIntensity * 0.32 }}
        />
      )}
      <div
        ref={sheetRef}
        className={`sheet sheet-stage-${stage}${dragging ? " is-dragging" : ""}`}
        style={{ height: SHEET_HEIGHT, transform: `translateY(${translate}px)` }}
        role={stage === "full" ? "dialog" : "region"}
        aria-modal={stage === "full" || undefined}
        aria-label={`${heading}の詳細`}
      >
        {/* ハンドル + スワイプ受付エリア。タップでも段送り */}
        <div
          className="sheet-handle-wrap"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <button
            className="sheet-handle-btn"
            aria-label={stage === "full" ? "シートを縮める" : "シートを拡大"}
            onClick={toggle}
          >
            <span className="sheet-handle" />
          </button>
        </div>

        <div className="sheet-content">
          <div className="panel-head-top">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 className="panel-title" style={{ fontSize: 17 }}>{heading}</h2>
              <p className="panel-sub" style={{ margin: "2px 0 0" }}>
                {hasRent(m.rent.value) ? (
                  <>家賃 <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{m.rent.value.toLocaleString()}</strong> 円/月</>
                ) : (
                  <>家賃 <strong style={{ color: "var(--text-muted)" }}>データなし</strong></>
                )}
                <span className="trend-chip">{m.populationTrend}</span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              <button
                className="panel-close"
                aria-label={stage === "full" ? "シートを縮める" : "シートを拡大"}
                onClick={toggle}
              >
                {stage === "full" ? <ChevronDown /> : <ChevronUp />}
              </button>
              <button className="panel-close" aria-label="閉じる" onClick={onClose}>×</button>
            </div>
          </div>

          {/* peek では指標カードは隠す（地図優先・名称＋家賃のみ）。
              half 高の実測はこの要素の下端を基準にする（ref）。 */}
          {stage !== "peek" && (
            <div ref={halfContentRef} style={{ marginTop: 10 }}>
              <MetricCards m={m} />
            </div>
          )}

          {stage === "full" && (
            <div style={{ marginTop: 14 }}>
              <div className="summary-block">{buildSummary(m)}</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0" }}>
                人口 {m.population.toLocaleString()}人
              </p>
              {m.hazard.note && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0" }}>
                  災害メモ: {m.hazard.note}
                </p>
              )}
              <Link href={`/area/${m.pref}/${m.code}`} className="cta-button">
                詳細を見る →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ChevronUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
