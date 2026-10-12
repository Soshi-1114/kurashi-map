// 指標の統計基準時点（asOf）を日付として比較するためのヘルパー。
// これらはページの公開・更新日を表さず、sitemap の lastmod には使用しない。
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
