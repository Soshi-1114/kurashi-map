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
