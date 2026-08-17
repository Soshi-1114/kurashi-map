// 詳細ページの再利用カード群（KPI・指標カード・回遊カード・ランキング・類似エリア・
// データなし・出典行）。すべて素の className（area-detail.css）で配色する server component。
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ChevronRight, MinusCircle } from "lucide-react";
import { formatAsOfJa } from "@/lib/rankings";

// ---- KPI カード（家賃・人口・地価・待機児童などの横長タイル）----
export function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  sub,
  compare,
  nodataLabel = "データなし",
}: {
  icon: LucideIcon;
  tone?: string;
  label: string;
  value: string | null;
  unit?: string;
  sub?: ReactNode;
  /** 比較文脈の小行（例: 全国◯位・全国平均◯円）。欠損時は渡さない */
  compare?: string;
  nodataLabel?: string;
}) {
  const isNoData = value === null;
  return (
    <div className={`ad-kpi ${isNoData ? "is-nodata" : ""}`}>
      <span className={`ad-kpi-icon ${tone ?? ""}`} aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="ad-kpi-label">{label}</span>
      {isNoData ? (
        <span className="ad-kpi-value is-nodata">{nodataLabel}</span>
      ) : (
        <span className="ad-kpi-value">
          {value}
          {unit && <span className="ad-kpi-unit">{unit}</span>}
        </span>
      )}
      {sub && <span className="ad-kpi-sub">{sub}</span>}
      {compare && <span className="ad-kpi-compare">{compare}</span>}
    </div>
  );
}

// ---- 指標カード（詳細グリッドの共通シェル: アイコン＋タイトル＋本文＋詳細リンク）----
export function MetricCard({
  id,
  icon: Icon,
  tone,
  title,
  badge,
  link,
  children,
}: {
  id?: string;
  icon: LucideIcon;
  tone?: string;
  title: string;
  badge?: { text: string; tone?: string };
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <article className="ad-metric-card" id={id}>
      <header className="ad-metric-head">
        <span className={`ad-metric-icon ${tone ?? ""}`} aria-hidden="true">
          <Icon size={20} />
        </span>
        <h3 className="ad-metric-title">{title}</h3>
        {badge && <span className={`ad-chip ${badge.tone ?? ""}`}>{badge.text}</span>}
      </header>
      <div className="ad-metric-body">{children}</div>
      {link && (
        <Link href={link.href} className="ad-metric-link">
          {link.label}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

export function MetricPrimary({
  value,
  unit,
  nodataLabel = "データなし",
}: {
  value: string | null;
  unit?: string;
  nodataLabel?: string;
}) {
  if (value === null) return <p className="ad-metric-primary is-nodata">{nodataLabel}</p>;
  return (
    <p className="ad-metric-primary">
      {value}
      {unit && <span className="ad-metric-unit">{unit}</span>}
    </p>
  );
}

// ---- 回遊リスト（家賃が近い・似ているエリア・主要自治体・兄弟区など）----
// カードのグリッドではなく、1枚の面の中に区切り線で並ぶコンパクトな行。
// 面と行の区切り線は .ad-arearow-list（親 ul）側の CSS が前提なので、
// ul と li をセットでここに置いて対にする。
export function AreaLinkList({ children }: { children: ReactNode }) {
  return <ul className="ad-arearow-list">{children}</ul>;
}

// 1行。compareHref があれば行の右端に「＋比較する」を添える
// （行本体が既にリンクのため別 <a> にする）。
export function AreaLinkRow({
  href,
  name,
  meta,
  compareHref,
}: {
  href: string;
  name: string;
  meta: string;
  compareHref?: string;
}) {
  return (
    <li className="ad-arearow">
      <Link href={href} className="ad-arearow-link">
        <span className="ad-arearow-name">{name}</span>
        <span className="ad-arearow-meta">{meta}</span>
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
      {compareHref && (
        <Link href={compareHref} className="ad-compare-add">
          ＋比較する
        </Link>
      )}
    </li>
  );
}

// ---- ランキングカード（カード全体がクリック可能。順位は任意）----
export function RankingCard({
  icon: Icon,
  title,
  rankText,
  href,
}: {
  icon: LucideIcon;
  title: string;
  rankText?: string;
  href: string;
}) {
  return (
    <Link href={href} className="ad-rankcard">
      <span className="ad-rankcard-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="ad-rankcard-body">
        <span className="ad-rankcard-title">{title}</span>
        {rankText && <span className="ad-rankcard-rank">{rankText}</span>}
      </span>
      <ArrowRight size={18} aria-hidden="true" className="ad-rankcard-arrow" />
    </Link>
  );
}

// ---- データなし／出典行 ----
export function NoData({ text, reason }: { text: string; reason: string }) {
  return (
    <div className="ad-nodata">
      <MinusCircle size={20} aria-hidden="true" />
      <p className="ad-nodata-text">
        <strong>{text}</strong>
        <span className="ad-nodata-reason">{reason}</span>
      </p>
    </div>
  );
}

export function SourceLine({
  source,
  asOf,
  estimated,
}: {
  source: string;
  asOf: string;
  estimated?: boolean;
}) {
  return (
    <p className="ad-source">
      出典: {source}（{formatAsOfJa(asOf)}）{estimated && <span className="ad-est">推計</span>}
    </p>
  );
}
