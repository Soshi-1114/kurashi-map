// 町丁名（大字・町丁目）による自治体検索。data/towns.json（scripts/fetch-towns.mjs 生成、
// 約12万町丁・4MB強）はクライアントに配信せず、/api/town-search だけがここを通して読む
// （軽量サマリ＋選択時フル取得の2段階配信方針と同じ考え方）。
import { toHiragana } from "./kana";

export type TownHit = { code: string; town: string };
type TownIndexEntry = { code: string; town: string; kana: string };

/** クエリの最小文字数。1文字は候補が多すぎて実用にならないため足切りする。 */
export const TOWN_QUERY_MIN = 2;

// towns.json のロードは初回リクエストまで遅延し、以後プロセス内で共有する。
// 動的 import はチャンク分割のため（このファイルを読まないページのバンドルに含めない）。
let indexPromise: Promise<TownIndexEntry[]> | null = null;
function loadTownIndex(): Promise<TownIndexEntry[]> {
  if (!indexPromise) {
    indexPromise = import("@/data/towns.json").then((mod) => {
      // tsc は静的パスの JSON import を実データから逐語的に推論する（例:
      // 個別自治体コードごとの string[][]）ため、素通しせず unknown 経由で
      // 意図した型（{code: [町丁名, かな][]}）へキャストする。
      const towns = (mod.default ?? mod).towns as unknown as Record<string, [string, string][]>;
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
 * スコアは4種類しかないため、比較ソートせず4バケツに振り分けて順に連結する
 * （インデックス全件を1パス走査するだけで済む）。
 * 結果は自治体単位に1件へ集約する（同じ市の複数町丁が並ぶより、自治体の多様性を優先。
 * 表示する町丁はその自治体で最も順位の高い1件）。
 */
export function searchTownIndex(index: TownIndexEntry[], rawQuery: string, limit = 8): TownHit[] {
  const q = rawQuery.trim();
  if (q.length < TOWN_QUERY_MIN) return [];
  const hq = toHiragana(q);
  const buckets: TownIndexEntry[][] = [[], [], [], []];
  for (const e of index) {
    if (e.town.startsWith(q)) buckets[0].push(e);
    else if (e.kana !== "" && e.kana.startsWith(hq)) buckets[1].push(e);
    else if (e.town.includes(q)) buckets[2].push(e);
    else if (e.kana !== "" && e.kana.includes(hq)) buckets[3].push(e);
  }
  const out: TownHit[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    for (const e of bucket) {
      if (seen.has(e.code)) continue;
      seen.add(e.code);
      out.push({ code: e.code, town: e.town });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** 町丁名検索（データロード込み）。/api/town-search から呼ぶ。 */
export async function searchTowns(query: string, limit = 8): Promise<TownHit[]> {
  return searchTownIndex(await loadTownIndex(), query, limit);
}
