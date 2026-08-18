// sitemap の lastModified を「データの実 vintage（asOf）」から導く。
// 毎ビルド now を入れると『常に全更新』のノイズ信号になるため、データが実際に
// 更新された時だけ日付が動くよう、各指標の asOf を日付化して最大値を採る。
//
// asOf のフォーマットは混在する: "2024" / "2023" / "令和5年度" / "2025-04-01" / "2026-08" / "-"。

import type { Municipality } from "./types";

/** asOf 文字列 → Date（UTC基準）。パース不能・「-」・空は null。 */
export function parseAsOf(asOf: string): Date | null {
  const s = String(asOf ?? "").trim();
  if (!s || s === "-") return null;
  // 完全な ISO 日付 "YYYY-MM-DD"（地価・待機児童などの基準日）
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
  // 年月 "YYYY-MM"（電気料金プランの確認時点など）。月初に丸める。
  const ym = s.match(/^(\d{4})-(\d{2})$/);
  if (ym) return new Date(`${ym[1]}-${ym[2]}-01T00:00:00Z`);
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

/**
 * 複数の asOf 候補から最も新しいものを1つ、元の文字列のまま返す（表示整形は呼び出し側）。
 * パース不能・null・undefined は無視。1つも解釈できなければ null。
 *
 * description 冒頭の「更新」バッジ等、複数指標の asOf を比較して最新を選ぶ用途で使う。
 * 呼び出し側は「実際に本文へ書く指標の asOf だけ」を渡すこと（本文に出てこない指標を
 * 混ぜると、バッジの年と本文の内容が食い違い誤解を招く）。
 */
export function latestAsOf(asOfs: (string | null | undefined)[]): string | null {
  let best: { raw: string; date: Date } | null = null;
  for (const raw of asOfs) {
    if (!raw) continue;
    const date = parseAsOf(raw);
    if (date && (!best || date > best.date)) best = { raw, date };
  }
  return best?.raw ?? null;
}

// ===== テンプレート改訂日 =====
//
// sitemap の lastModified は上記のとおりデータの asOf 由来だが、それだけだと
// 「データは変わっていないがページの中身は変わった」変更（title/description の刷新、
// セクションの追加など）を検索エンジンに伝えられない。そこで URL 数の少ない
// ページ種別（/denki・/map/*）に限り、テンプレート改訂日との新しい方を採る。
//
// 大量ページ種別（自治体 1,918・県ハブ 47・ランキング系 ~770）には適用しない。
// 2026-08 に全種別へ適用した結果、sitemap 2,744 URL 中 2,734 件の lastmod が
// テンプレ改訂日の同一日付に揃い、「全ページが同日に更新された」と主張する
// 毎ビルド now と同型のノイズ信号になった。lastmod はページごとに日付が分散して
// いてこそ信頼されるため、大量種別はデータ asOf 由来のみとし、テンプレ改訂の
// 通知は本番デプロイ後の `node scripts/indexnow-submit.mjs` で代替する
// （IndexNow が届くのは Bing 系のみ。Google に対しては「lastmod が信頼できる
// sitemap」を維持することが再クロール判断の材料になる）。
//
// 背景: 2026-08 の GSC URL Inspection API 診断で、表示ゼロの自治体ページの最終クロールが
// 公開直後（2026-06-21）のまま7週間動いていないことが分かった（テンプレ改訂日導入の発端）。
//
// 運用: テンプレート（ページの生成ロジック）を実際に変更したときだけ、該当キーの日付を
// 手で進める。本文・title・description・構造化データが実質的に変わる変更のみが対象で、
// リファクタや軽微な文言調整では進めない。
//
// 日付は「実際にページ内容が変わった日（本番反映日）」を UTC で入れる。未来日を入れると
// 検索エンジンに無視されるため、深夜デプロイでも翌日に繰り上げないこと。
// なお docs/seo/url-sets.json の since（効果計測の起点）とは目的が違うので値がずれてよい:
// lastModified は「いつ変わったか」、since は「新しい内容が丸一日配信された最初の日」。
export const TEMPLATE_REVISED_AT = {
  /** /map/* 指標別地図ハブ。2026-08-17: description・見出し・本文にデータ基準年度を追加（PR #144）。
   *  2026-08-11: /map/future-population 新規公開（PR #138） */
  mapHub: "2026-08-17",
  /** /denki 電気代シミュレーター。2026-08-17: 新規公開（PR #140-#142）。
   *  注: 2026-08-17 は本番反映日。デプロイがずれたら実反映日に直すこと */
  denki: "2026-08-17",
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
