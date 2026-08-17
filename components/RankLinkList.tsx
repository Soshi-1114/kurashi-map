// ランキングへの導線を、1枚の面に区切り線で並ぶ行リストで出すセクション
// （サーバーコンポーネント）。ランキングページの「ほかのランキング」と
// 都道府県ハブの「{県}のランキングで比べる」で共有する。見出し・リンク先・
// ラベル接頭辞だけが違い、マークアップは同一のため。
// 対象が空なら何も描画しない（呼び出し側で length チェックをしない）。

import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import type { RankingDef } from "@/lib/rankings";

// タイトルを「強調する指標フレーズ」と「共通の語尾」に分ける。ランキングの title は
// すべて「◯◯市区町村ランキング」か「◯◯の市区町村」で終わる（lib/rankings.ts）。
// リンク全文を太字にすると視線の置き所がなくなるため、指標フレーズだけを太字にする
// （例:「埼玉県の家賃が安い市区町村ランキング」→ 太字は「家賃が安い」のみ）。
function splitTitle(title: string): { em: string; rest: string } {
  for (const suffix of ["市区町村ランキング", "の市区町村"]) {
    if (title.endsWith(suffix)) return { em: title.slice(0, -suffix.length), rest: suffix };
  }
  return { em: title, rest: "" };
}

export default function RankLinkList({
  title,
  sub,
  rankings,
  href,
  labelPrefix,
}: {
  /** セクション見出し */
  title: string;
  /** 見出し下の補足文 */
  sub: string;
  /** 並べるランキング定義 */
  rankings: RankingDef[];
  /** ランキング定義からリンク先 URL を組み立てる */
  href: (r: RankingDef) => string;
  /** 各行ラベルの接頭辞（例:「埼玉県の」）。強調対象には含めない */
  labelPrefix?: string;
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
      <ul className="rk-rank-list">
        {rankings.map((r) => {
          const { em, rest } = splitTitle(r.title);
          return (
            <li key={r.slug}>
              <Link href={href(r)} className="rk-rank-row">
                <span className="rk-rank-row-label">
                  {labelPrefix}
                  <b>{em}</b>
                  {rest}
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
