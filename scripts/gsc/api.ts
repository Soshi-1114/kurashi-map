// GSC Search Analytics API の呼び出し（ページング + リトライ）。
// searchAnalytics.query は 1 リクエスト最大 25,000 行なので、返り件数が rowLimit を
// 下回るまで startRow を進めながら呼び続ける。GSC 自体の仕様として、上位データ中心の
// 抽出・匿名化により「完全な全件取得を保証できない」制約がある（README / summary.md に明記）。

import { getAccessToken } from "./auth";
import type { GscApiRow } from "./types";

const ROW_LIMIT = 25000;
const MAX_ATTEMPTS = 6;

export interface QueryOptions {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  searchType?: string; // 既定 "web"
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** attempt);
}

async function queryPage(token: string, opts: QueryOptions, startRow: number): Promise<GscApiRow[]> {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    opts.siteUrl,
  )}/searchAnalytics/query`;
  const body = {
    startDate: opts.startDate,
    endDate: opts.endDate,
    dimensions: opts.dimensions,
    type: opts.searchType ?? "web",
    dataState: "all",
    rowLimit: ROW_LIMIT,
    startRow,
  };

  let lastErr = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      lastErr = `fetch失敗: ${e instanceof Error ? e.message : String(e)}`;
      console.warn(`GSC API fetch 失敗 (${attempt + 1}/${MAX_ATTEMPTS}): ${lastErr}`);
      await new Promise((r) => setTimeout(r, backoffMs(attempt)));
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as { rows?: GscApiRow[] };
      return data.rows ?? [];
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = `HTTP ${res.status}`;
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = retryAfter > 0 ? Math.min(120_000, retryAfter * 1000) : backoffMs(attempt);
      console.warn(`GSC API 失敗 (${attempt + 1}/${MAX_ATTEMPTS}): ${lastErr} — ${wait}ms 後に再試行`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const text = await res.text().catch(() => "");
    throw new Error(
      `GSC API 失敗: HTTP ${res.status} dimensions=[${opts.dimensions.join(",")}] ${text.slice(0, 500)}`,
    );
  }
  throw new Error(
    `GSC API 失敗: リトライ上限到達 dimensions=[${opts.dimensions.join(",")}] 最終エラー: ${lastErr}`,
  );
}

/** 指定した dimensions で全行をページングして取得する。 */
export async function fetchAllRows(opts: QueryOptions): Promise<GscApiRow[]> {
  const token = await getAccessToken();
  const rows: GscApiRow[] = [];
  let startRow = 0;
  for (;;) {
    const page = await queryPage(token, opts, startRow);
    rows.push(...page);
    if (page.length < ROW_LIMIT) break;
    startRow += ROW_LIMIT;
  }
  return rows;
}
