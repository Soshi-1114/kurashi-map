// 町丁名（大字・町丁目）による自治体検索。data/towns.json（scripts/fetch-towns.mjs 生成、
// 約12万町丁・4MB強）はクライアントに配信せず、/api/town-search だけがここを通して読む
// （軽量サマリ＋選択時フル取得の2段階配信方針と同じ考え方）。
import { toHiragana } from "./kana";

export type TownHit = { code: string; town: string };
type TownIndexEntry = { code: string; town: string; kana: string };

/** クエリの最小文字数。1文字は候補が多すぎて実用にならないため足切りする。 */
export const TOWN_QUERY_MIN = 2;

// towns.json のロードは初回リクエストまで遅延し、以後プロセス内で共有する。
// リテラルでない動的 import は lib/prefs.ts と同じパターン（tsc に 4MB JSON を
// 型解析させず、バンドラにはチャンクとして含めさせる）。
let indexPromise: Promise<TownIndexEntry[]> | null = null;
function loadTownIndex(): Promise<TownIndexEntry[]> {
  if (!indexPromise) {
    const file = "towns";
    indexPromise = import(`@/data/${file}.json`).then((mod) => {
      const towns = (mod.default ?? mod).towns as Record<string, [string, string][]>;
      const out: TownIndexEntry[] = [];
      for (const [code, list] of Object.entries(towns)) {
        for (const [town, kana] of list) out.push({ code, town, kana });
      }
      return out;
    });
  }
  return indexPromise;
}

/**
 * 町丁名インデックスをクエリで検索する（純関数・テスト対象）。
 * 順位: 名前が前方一致 > 読みが前方一致 > 名前が部分一致 > 読みが部分一致。
 * 結果は自治体単位に1件へ集約する（同じ市の複数町丁が並ぶより、自治体の多様性を優先。
 * 表示する町丁はその自治体で最も順位の高い1件）。
 */
export function searchTownIndex(index: TownIndexEntry[], rawQuery: string, limit = 8): TownHit[] {
  const q = rawQuery.trim();
  if (q.length < TOWN_QUERY_MIN) return [];
  const hq = toHiragana(q);
  const scored: { score: number; code: string; town: string }[] = [];
  for (const e of index) {
    let score: number;
    if (e.town.startsWith(q)) score = 0;
    else if (e.kana !== "" && e.kana.startsWith(hq)) score = 1;
    else if (e.town.includes(q)) score = 2;
    else if (e.kana !== "" && e.kana.includes(hq)) score = 3;
    else continue;
    scored.push({ score, code: e.code, town: e.town });
  }
  scored.sort((a, b) => a.score - b.score); // 同スコアは元順（=コード順）を保つ安定ソート
  const out: TownHit[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    out.push({ code: s.code, town: s.town });
    if (out.length >= limit) break;
  }
  return out;
}

/** 町丁名検索（データロード込み）。/api/town-search から呼ぶ。 */
export async function searchTowns(query: string, limit = 8): Promise<TownHit[]> {
  return searchTownIndex(await loadTownIndex(), query, limit);
}
