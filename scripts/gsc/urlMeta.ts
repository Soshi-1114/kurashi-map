// KurashiMap の URL 構造を分類する。ルーティングは app/ 配下のディレクトリ構成
// （/, /area/{pref}, /area/{pref}/{code}, /ranking, /ranking/{slug}, /ranking/{slug}/{pref},
//  /map/{metric}, /compare, /about, /privacy）から機械的に判定する。
//
// 自治体マスタ（コード・都道府県・名称・URL）は data/*.json をそのまま読み込んで再利用する
// （lib/prefs.ts の PREFS と同じ内容を持つ scripts/_lib/prefs.mjs 経由）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error mjs モジュール（データスクリプト共通ヘルパー）に型定義はない
import { PREFS as SCRIPT_PREFS } from "../_lib/prefs.mjs";
import { fetchAllRows, type QueryOptions } from "./api";
import type { GscApiRow, MuniMeta, PageType, UrlMeta } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

interface RawMuni {
  code: string;
  name: string;
  displayName?: string;
}

let muniMasterCache: Map<string, MuniMeta> | null = null;

/** data/{slug}.json + data/{slug}_wards.json を全県分読み込み、code をキーにしたマスタを返す。 */
export function loadMuniMaster(): Map<string, MuniMeta> {
  if (muniMasterCache) return muniMasterCache;
  const map = new Map<string, MuniMeta>();
  for (const slug of Object.keys(SCRIPT_PREFS)) {
    const pref = SCRIPT_PREFS[slug] as { nameJa: string };
    for (const file of [`${slug}.json`, `${slug}_wards.json`]) {
      const fp = path.join(ROOT, "data", file);
      if (!fs.existsSync(fp)) continue;
      const list = JSON.parse(fs.readFileSync(fp, "utf-8")) as RawMuni[];
      for (const m of list) {
        map.set(m.code, {
          code: m.code,
          prefSlug: slug,
          prefNameJa: pref.nameJa,
          name: m.name,
          displayName: m.displayName ?? m.name,
          url: `/area/${slug}/${m.code}`,
        });
      }
    }
  }
  muniMasterCache = map;
  return map;
}

export function prefNameFor(slug: string): string | undefined {
  return (SCRIPT_PREFS[slug] as { nameJa: string } | undefined)?.nameJa;
}

/** すべての pref slug（scripts/_lib/prefs.mjs 準拠）。 */
export function allPrefSlugs(): string[] {
  return Object.keys(SCRIPT_PREFS);
}

/** GSC の URL（フル URL または path）からパス部分だけを正規化して取り出す。 */
export function normalizeUrlPath(raw: string): string {
  let pathname: string;
  try {
    pathname = new URL(raw).pathname;
  } catch {
    pathname = raw.startsWith("/") ? raw : `/${raw}`;
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // 不正なパーセントエンコーディングはそのまま使う
  }
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
  return pathname || "/";
}

/**
 * page dimension を含む GSC 行を正規化する。GSC は page キーにフル URL
 * （例: "https://kurashimap.jp/area/saitama/11203"）を返すが、自治体マスタ（MuniMeta.url）は
 * パスのみ（"/area/saitama/11203"）を持つため、正規化しないと突き合わせが一致しない。
 * keys[0] が page（他の次元は keys[1] 以降にそのまま残す）である行の配列に適用する。
 */
export function normalizePageRows<T extends { keys: string[] }>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, keys: [normalizeUrlPath(r.keys[0]), ...r.keys.slice(1)] }));
}

export interface PageRowsFetch {
  /** GSC の生レスポンス（page キーがフル URL のまま。raw/ ダンプ用） */
  raw: GscApiRow[];
  /** normalizePageRows 済み（自治体マスタ等との突き合わせ用） */
  normalized: GscApiRow[];
}

/**
 * dimensions に "page" を含む取得を、生レスポンスと正規化済みの両方を返す形にまとめる。
 * 取得と正規化を呼び出し側で別々に行うと正規化を呼び忘れる余地があるため、1つの関数に
 * 閉じ込める（page dimension を fetch する箇所は必ずこれを経由する）。
 */
export async function fetchPageRows(opts: QueryOptions): Promise<PageRowsFetch> {
  const raw = await fetchAllRows(opts);
  return { raw, normalized: normalizePageRows(raw) };
}

/** URL を pageType に分類し、pref/muni/ranking 等の付帯情報を付与する。 */
export function classifyUrl(rawUrl: string, muniMaster: Map<string, MuniMeta>): UrlMeta {
  const path = normalizeUrlPath(rawUrl);
  const segs = path.split("/").filter(Boolean);
  const base = { url: rawUrl, path };

  if (path === "/") return { ...base, pageType: "top" };

  if (segs[0] === "area") {
    if (segs.length === 2) {
      const prefSlug = segs[1];
      return { ...base, pageType: "prefecture", prefSlug, prefNameJa: prefNameFor(prefSlug) };
    }
    if (segs.length >= 3) {
      const code = segs[2];
      const meta = muniMaster.get(code);
      return {
        ...base,
        pageType: "municipality",
        prefSlug: segs[1],
        prefNameJa: meta?.prefNameJa ?? prefNameFor(segs[1]),
        muniCode: code,
        muniName: meta?.name,
      };
    }
  }

  if (segs[0] === "ranking") {
    const type: PageType = "ranking";
    return {
      ...base,
      pageType: type,
      rankingSlug: segs[1],
      prefSlug: segs[2],
      prefNameJa: segs[2] ? prefNameFor(segs[2]) : undefined,
    };
  }

  if (segs[0] === "map") {
    return { ...base, pageType: "map", mapMetric: segs[1] };
  }

  if (segs[0] === "compare") return { ...base, pageType: "compare" };
  if (segs[0] === "about" || segs[0] === "privacy") return { ...base, pageType: "about" };

  return { ...base, pageType: "other" };
}
