// ランキングへの導線をピルの一覧で並べるセクション（サーバーコンポーネント）。
// ランキングページの「ほかのランキング」と都道府県ハブの「{県}のランキングで比べる」で
// 共有する。見出し・リンク先・ラベルだけが違い、マークアップは同一のため。
// 対象が空なら何も描画しない（呼び出し側で length チェックをしない）。

import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import type { RankingDef } from "@/lib/rankings";

export default function RankPillLinks({
  title,
  sub,
  rankings,
  href,
  label,
}: {
  /** セクション見出し */
  title: string;
  /** 見出し下の補足文 */
  sub: string;
  /** 並べるランキング定義 */
  rankings: RankingDef[];
  /** ランキング定義からリンク先 URL を組み立てる */
  href: (r: RankingDef) => string;
  /** ランキング定義からアンカーテキストを組み立てる */
  label: (r: RankingDef) => string;
}) {
  if (rankings.length === 0) return null;
  return (
    <section className="rk-section">
      <div className="rk-section-head">
        <span className="rk-section-icon"><Trophy size={20} aria-hidden="true" /></span>
        <div className="rk-section-heading">
          <h2 className="rk-h2">{title}</h2>
          <p className="rk-section-sub">{sub}</p>
        </div>
      </div>
      <ul className="rk-pill-grid">
        {rankings.map((r) => (
          <li key={r.slug}>
            <Link href={href(r)} className="rk-pill">
              {label(r)}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
