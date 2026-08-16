// sitemap の lastModified を「データの実 vintage（asOf）」から導く。
// 毎ビルド now を入れると『常に全更新』のノイズ信号になるため、データが実際に
// 更新された時だけ日付が動くよう、各指標の asOf を日付化して最大値を採る。
//
// asOf のフォーマットは混在する: "2024" / "2023" / "令和5年度" / "2025-04-01" / "-"。

import type { Municipality } from "./types";

/** asOf 文字列 → Date（UTC基準）。パース不能・「-」・空は null。 */
export function parseAsOf(asOf: string): Date | null {
  const s = String(asOf ?? "").trim();
  if (!s || s === "-") return null;
  // 完全な ISO 日付 "YYYY-MM-DD"（地価・待機児童などの基準日）
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  // 西暦年（"2024" / "2023年" 等）。年のみは 1/1 に丸める。
  const yr = s.match(/(\d{4})/);
  if (yr) return new Date(`${yr[1]}-01-01T00:00:00Z`);
  // 和暦 "令和N年(度)"（令和1=2019）
  const reiwa = s.match(/令和\s*(\d+)\s*年/);
  if (reiwa) return new Date(`${2018 + Number(reiwa[1])}-01-01T00:00:00Z`);
  return null;
}

/** 1自治体の全指標 asOf のうち最も新しい日付。1つも無ければ null。 */
export function muniLastModified(m: Municipality): Date | null {
  const candidates = [
    m.rent?.asOf,
    m.landPrice?.asOf,
    m.waitlistChildren?.asOf,
    m.foreignResidents?.asOf,
    m.hazard?.asOf,
    m.amenities?.asOf,
  ];
  let max: Date | null = null;
  for (const c of candidates) {
    const d = parseAsOf(c ?? "");
    if (d && (!max || d > max)) max = d;
  }
  return max;
}

/** 自治体群を通じて最も新しい asOf 日付。空・全 null なら null。 */
export function latestLastModified(munis: Municipality[]): Date | null {
  let max: Date | null = null;
  for (const m of munis) {
    const d = muniLastModified(m);
    if (d && (!max || d > max)) max = d;
  }
  return max;
}

// ===== テンプレート改訂日 =====
//
// sitemap の lastModified は上記のとおりデータの asOf 由来だが、それだけだと
// 「データは変わっていないがページの中身は変わった」変更（title/description の刷新、
// セクションの追加など）を検索エンジンに伝えられない。
//
// 背景: 2026-08 の GSC URL Inspection API 診断で、表示ゼロの自治体ページの最終クロールが
// 公開直後（2026-06-21）のまま7週間動いていないことが分かった。この状態でテンプレートを
// 変えても、Google から見ると「6月から何も変わっていないページ」なので見に来る動機がない。
//
// 運用: テンプレート（ページの生成ロジック）を実際に変更したときだけ、該当キーの日付を
// 手で進める。毎ビルド動く now とは違い「変えたときだけ動く」ので、ノイズ信号にならない。
//
// 日付は「実際にページ内容が変わった日（本番反映日）」を UTC で入れる。未来日を入れると
// 検索エンジンに無視されるため、深夜デプロイでも翌日に繰り上げないこと。
// なお docs/seo/url-sets.json の since（効果計測の起点）とは目的が違うので値がずれてよい:
// lastModified は「いつ変わったか」、since は「新しい内容が丸一日配信された最初の日」。
export const TEMPLATE_REVISED_AT = {
  /** /area/{pref}/{code} 自治体詳細。2026-08-16: 電気代シミュレーター導線（供給エリア名表示）を追加。
   *  2026-08-11: 将来人口（IPSS 2050年推計）カードを追加（PR #138）。
   *  2026-08-10: title を人口・家賃・外国人割合の実数値並びに刷新（PR #129） */
  areaMuni: "2026-08-16",
  /** /area/{pref} 県ハブ。2026-08-10: title の重複解消＋データ概況表・全ランキング導線を追加（PR #127/#130） */
  areaPref: "2026-08-10",
  /** /ranking/{slug} 全国ランキング。2026-08-10: population 系に実数値入り description を追加（PR #126） */
  ranking: "2026-08-10",
  /** /ranking/{slug}/{pref} 県別ランキング。2026-08-10: description の掲載件数を文頭へ（PR #126） */
  rankingPref: "2026-08-10",
} as const;

/**
 * データ由来の日付とテンプレート改訂日の新しい方を返す。
 * ページの内容は「データ」と「テンプレート」の両方で決まるため、
 * どちらかが新しくなればそのページは更新されている。
 */
export function withTemplateRevision(
  dataDate: Date,
  revisedAt: (typeof TEMPLATE_REVISED_AT)[keyof typeof TEMPLATE_REVISED_AT],
): Date {
  const template = new Date(`${revisedAt}T00:00:00Z`);
  return template > dataDate ? template : dataDate;
}
