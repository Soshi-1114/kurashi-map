// 財政力指数（総務省「地方公共団体の主要財政指標一覧」）のアクセサ。UI・ランキングは
// 必ずここを経由する（hasRent / hasVacancy 等と同じ「対象判定をヘルパーに集約」方針）。
//
// 財政力指数 = 基準財政収入額 ÷ 基準財政需要額（3か年平均）。1を超えると普通交付税の
// 不交付団体。指数が低い自治体には地方交付税で標準的な行政サービスの財源が保障される
// ため、低さは行政サービスの質や自治体の優劣を意味しない（UI は必ず中立注記を添える）。

import type { Municipality } from "./types";

type Fiscal = NonNullable<Municipality["fiscal"]>;

// 東京23特別区の source 判定語。都区財政調整制度下の算定で、大都市税源（固定資産税・
// 市町村民税法人分等）が都に帰属するため、市町村の指数と同一土俵で比較できない
// （出典の「全国市町村平均」も特別区を除いて算出されている）。
const SPECIAL_WARD_MARK = "都区財政調整";

/**
 * NoData 表示用の source。hasFiscal の否定分岐では m.fiscal が undefined に絞り込まれ
 * センチネルの source を参照できないため、UI は絞り込み前の値をこのアクセサ経由で
 * 取り出す（futurePopulation.ts の futurePopSource と同じ理由）。
 */
export function fiscalSource(f: Municipality["fiscal"]): string {
  return f?.source ?? "対象外（未収録）";
}

/** 財政力指数の実データがあるか（index=-1 は出典に行がない対象外センチネル）。 */
export function hasFiscal(f: Municipality["fiscal"]): f is Fiscal {
  return f != null && f.index > 0;
}

/**
 * ランキングの集計対象か。実データがあり、かつ東京23特別区（都区財政調整制度下の
 * 算定）でないこと。特別区は詳細ページ・比較ページには注記付きで表示する
 * （公表実データを隠さない）が、市町村と同一の順位表に並べると誤解を生むため除外する。
 */
export function isFiscalRankable(f: Municipality["fiscal"]): f is Fiscal {
  return hasFiscal(f) && !f.source.includes(SPECIAL_WARD_MARK);
}

/** 特別区（都区財政調整制度下の算定）か。UI の注記文の出し分けに使う。 */
export function isFiscalSpecialWard(f: Municipality["fiscal"]): boolean {
  return f != null && f.source.includes(SPECIAL_WARD_MARK);
}

/** 表示用: "0.85"（小数2桁）。データなしは "—"。 */
export function fiscalIndexText(f: Municipality["fiscal"]): string {
  return hasFiscal(f) ? f.index.toFixed(2) : "—";
}
