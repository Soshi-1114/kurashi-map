// e-Stat (政府統計の総合窓口) getStatsData の共通呼び出し。
// cdArea は 1 リクエスト 100 件までのため自動でチャンク分割する（北海道=179自治体など）。

const ESTAT_ENDPOINT = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";

/** ESTAT_APP_ID を取得。未設定なら終了。 */
export function requireEstatAppId() {
  const id = process.env.ESTAT_APP_ID;
  if (!id) { console.error("ESTAT_APP_ID が未設定"); process.exit(1); }
  return id;
}

// e-Stat への一過性の接続失敗（UND_ERR_CONNECT_TIMEOUT 等）やレート制限を吸収するため、
// リクエスト全体のタイムアウト＋指数バックオフのリトライで包む。
// リトライ方針は reinfolib.mjs と統一（8回・上限60s・Retry-After 尊重）。
// 旧: 5回・上限8秒は数分規模の一時障害に足りず annual で失敗することがあった。
// 429/5xx とネットワークエラーはリトライ、その他の 4xx は即 throw（無駄な再試行をしない）。
export const ESTAT_MAX_ATTEMPTS = 8;
const estatBackoffMs = (attempt) => Math.min(60_000, 1000 * 2 ** attempt);

async function fetchJsonWithRetry(url, { attempts = ESTAT_MAX_ATTEMPTS, timeoutMs = 60_000 } = {}) {
  let lastErr = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      lastErr = `fetch失敗: ${e?.name ?? e}`;
      console.warn(`e-Stat fetch 失敗 (${attempt + 1}/${attempts}): ${lastErr}`);
      await new Promise((r) => setTimeout(r, estatBackoffMs(attempt)));
      continue;
    }
    if (res.ok) return await res.json();
    if (res.status === 429 || res.status >= 500) {
      lastErr = `HTTP ${res.status}`;
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = retryAfter > 0 ? Math.min(120_000, retryAfter * 1000) : estatBackoffMs(attempt);
      console.warn(`e-Stat fetch 失敗 (${attempt + 1}/${attempts}): ${lastErr} — ${wait}ms 後に再試行`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    // 400/401/403/404 等は再試行しても直らないので即座に中断。
    throw new Error(`e-Stat fetch -> HTTP ${res.status}`);
  }
  throw new Error(`e-Stat fetch failed after ${attempts} attempts (最終: ${lastErr})`);
}

// getStatsData を 100 area/リクエストで分割取得し、VALUE 行を素のまま
// （{"@area","@cat01","$",...}）配列で返す。集計方法は呼び出し側に委ねる。
export async function fetchStatsValues(appId, statsDataId, codes, extraParams = {}) {
  const rows = [];
  for (let i = 0; i < codes.length; i += 100) {
    const chunk = codes.slice(i, i + 100);
    const url = new URL(ESTAT_ENDPOINT);
    url.searchParams.set("appId", appId);
    url.searchParams.set("statsDataId", statsDataId);
    url.searchParams.set("cdArea", chunk.join(","));
    for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);
    url.searchParams.set("limit", "100000");
    const data = await fetchJsonWithRetry(url);
    const values = data.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];
    for (const v of Array.isArray(values) ? values : [values]) rows.push(v);
  }
  return rows;
}

// 地域軸が標準 cdArea でない表（例: 医療施設調査の cat02「二次医療圏・市区町村別」）向け:
// 絞り込みパラメータのみ指定して全行を1回で取得し、STATISTICAL_DATA（CLASS_INF 含む）を返す。
export async function fetchStatsData(appId, statsDataId, extraParams = {}) {
  const url = new URL(ESTAT_ENDPOINT);
  url.searchParams.set("appId", appId);
  url.searchParams.set("statsDataId", statsDataId);
  for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);
  url.searchParams.set("limit", "100000");
  const data = await fetchJsonWithRetry(url);
  return data.GET_STATS_DATA?.STATISTICAL_DATA ?? null;
}

// 単一値メトリクス向け: area コード -> 数値 の Map を返す。数値化できない行は除外。
export async function fetchValueByArea(appId, statsDataId, codes, extraParams = {}) {
  const byCode = new Map();
  for (const v of await fetchStatsValues(appId, statsDataId, codes, extraParams)) {
    const n = Number(v["$"]);
    if (!Number.isNaN(n)) byCode.set(v["@area"], n);
  }
  return byCode;
}
