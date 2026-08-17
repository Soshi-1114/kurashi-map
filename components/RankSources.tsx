// 「出典・データについて」の折りたたみセクション（rk-sources）。本文は呼び出し側が
// 渡す。ランキングページ（全国版・都道府県別）は共通本文 RANKING_SOURCES_TEXT を
// 使い、出典が変わったとき両ページを別々に直さなくて済むようにする。
// 県ハブ（/area/{pref}）のように県固有の動的な本文を渡す使い方もできる。
import type { ReactNode } from "react";
import { Database } from "lucide-react";

export const RANKING_SOURCES_TEXT =
  "家賃は住宅・土地統計調査、地価は地価公示・地価調査、待機児童はこども家庭庁の公表値、人口は国勢調査、外国人住民比率は出入国在留管理庁「在留外国人統計」に基づきます（e-Stat ほか）。政令指定都市の行政区は親市との重複を避けるため集計から除外しています。データのない自治体はランキングの対象外です。";

export default function RankSources({ children }: { children: ReactNode }) {
  return (
    <section className="rk-section">
      <details className="rk-sources">
        <summary className="rk-sources-summary">
          <Database size={15} aria-hidden="true" />出典・データについて
        </summary>
        <p className="rk-sources-body">{children}</p>
      </details>
    </section>
  );
}
