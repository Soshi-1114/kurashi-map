// 自治体詳細ページの title 生成。SEO の要になる文字列を純関数に切り出し、
// 文字数予算や分岐（同名自治体・行政区・統計対象外）をテストで固定できるようにする
// （lib/summary.ts・lib/faq.ts・lib/highlights.ts と同じ「builder は lib に置く」方針）。
//
// 検索結果の title は日本語で概ね30文字前後（サイト名を除く本文部分）で切れるため、
// 載せる要素は文字数と検索意図で取捨する。数値は lib/format.ts の短縮表記を使い、
// 欠損は推計せず単に省く（honesty 方針）。実数は description・本文が担う。

import type { Municipality } from "./types";
import { compactPopulation, compactYen } from "./format";
import { hasRent } from "./rentColor";
import { foreignRatioPct, hasForeignRatio } from "./foreignResidents";
import { SITE } from "./site";

export type TitleMuni = Pick<
  Municipality,
  "name" | "displayName" | "population" | "rent" | "foreignResidents"
>;

/** title 本文（" - サイト名" を除く部分）の目安上限。テストの回帰検出用。 */
export const TITLE_BODY_BUDGET = 35;

/**
 * 詳細ページの title を「人口 → 家賃 → 在留外国人割合」の順に実数値で組み立てる。
 *
 * 経緯: 2026-07 時点は「{自治体} 外国人」対策で在留外国人割合を主軸に据えていたが、
 * 2026-08 の GSC 分析でそれが他の検索意図を締め出していると判明した（人口系152表示・
 * CTR 0%、家賃系は県ハブに誤着地。いずれも title に語が無かった）。「{自治体} 住みやすさ」
 * は4クエリ・5表示まで縮小し title の文字数を割く価値が無くなったため、H1・description
 * 側に残して title からは外す。詳細は docs/seo/gsc-seo-implementation-plan-2026-08.md。
 *
 * ambiguous（同名自治体）のときだけ県名を添える。全件に付けると上限で肝心の数値が切れる。
 * 在留外国人割合は行政区でも出す（全国順位は持たないが比率は人口から算出できる）。
 * 人口・家賃がどちらも無い自治体（北方領土6村）は数値なしの文言にフォールバックする。
 */
export function buildMuniTitle(
  m: TitleMuni,
  { prefName, ambiguous }: { prefName: string; ambiguous: boolean },
): string {
  const fullName = m.displayName ?? m.name;
  const namePart = ambiguous ? `${fullName}（${prefName}）` : fullName;

  const metrics = [
    m.population > 0 ? `人口${compactPopulation(m.population)}` : null,
    hasRent(m.rent.value) ? `家賃${compactYen(m.rent.value)}` : null,
  ].filter((s) => s !== null);
  const metricsPart = metrics.length > 0 ? `${metrics.join("・")}｜` : "住みやすさ・";

  const ratio = foreignRatioPct(m);
  const foreignPart = hasForeignRatio(ratio) ? `外国人${ratio.toFixed(1)}%` : "住環境データ";

  return `${namePart}の${metricsPart}${foreignPart} - ${SITE.name}`;
}
