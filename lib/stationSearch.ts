// 駅名による検索。data/stations.json（scripts/build-station-index.mjs 生成、
// 国土数値情報 S12 由来の約9,300駅・~400KB）はクライアントに配信せず、
// /api/station-search だけがここを通して読む（towns.json と同じ2段階配信方針）。
//
// S12 の駅名は「駅」なし（例: 品川）。クエリ末尾の「駅」は取り除いてから照合する
// （「品川駅」でも「品川」でもヒット）。S12 に読み仮名は無いため、かな検索は
// 自治体名検索（MuniSummary.kana）と異なり非対応。

/**
 * 地図フライト用の駅代表点。検索ヒット（ComboboxHit.station）・フライト依頼
 * （MapFlyDetail.station）・MapView の点フライトが共有する唯一の形。
 */
export type StationPoint = { name: string; lng: number; lat: number };

/** 検索1件（駅代表点 + 所属自治体コード）。 */
export type StationHit = StationPoint & { code: string };

type StationIndexEntry = [name: string, code: string, lng: number, lat: number];

/** クエリの最小文字数（town-search と同じ足切り。「蕨駅」のような1文字駅名+駅は2文字で通る）。 */
export const STATION_QUERY_MIN = 2;

// stations.json のロードは初回リクエストまで遅延し、以後プロセス内で共有する。
let indexPromise: Promise<StationIndexEntry[]> | null = null;
function loadStationIndex(): Promise<StationIndexEntry[]> {
  if (!indexPromise) {
    indexPromise = import("@/data/stations.json").then(
      (mod) => ((mod.default ?? mod) as { stations: unknown }).stations as StationIndexEntry[],
    );
  }
  return indexPromise;
}

/**
 * 駅名インデックスをクエリで検索する（純関数・テスト対象）。
 * 順位: 完全一致 > 前方一致 > 部分一致。インデックスは名前順ソート済みのため、
 * バケツ内は五十音順に近い安定した並びになる。
 */
export function searchStationIndex(index: StationIndexEntry[], rawQuery: string, limit = 6): StationHit[] {
  const raw = rawQuery.trim();
  if (raw.length < STATION_QUERY_MIN) return [];
  // 末尾の「駅」を除去（「駅」1文字だけの入力は全件前方一致になるため空扱い）
  const q = raw.endsWith("駅") ? raw.slice(0, -1) : raw;
  if (q.length === 0) return [];
  // 各バケツは最終的に先頭 limit 件しか使わないため、それ以上は溜めない
  // （「ヶ丘」等の広い部分一致で数百件の配列を作らない）。
  const buckets: StationIndexEntry[][] = [[], [], []];
  const push = (k: number, e: StationIndexEntry) => { if (buckets[k].length < limit) buckets[k].push(e); };
  for (const e of index) {
    const name = e[0];
    if (name === q) push(0, e);
    else if (name.startsWith(q)) push(1, e);
    else if (name.includes(q)) push(2, e);
  }
  const out: StationHit[] = [];
  for (const bucket of buckets) {
    for (const [name, code, lng, lat] of bucket) {
      out.push({ name, code, lng, lat });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** 駅名検索（データロード込み）。/api/station-search から呼ぶ。 */
export async function searchStations(query: string, limit = 6): Promise<StationHit[]> {
  return searchStationIndex(await loadStationIndex(), query, limit);
}
