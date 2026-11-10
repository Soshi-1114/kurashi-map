import fs from "node:fs";
import { JWT } from "google-auth-library";
import { getAccessToken } from "../gsc/auth";
import { HOST, PROPERTY, SITE, type Capture, type GaResponse, type GscResponse, type Range } from "./model";

export type Request = (api: "ga" | "gsc", endpoint: string, body?: object) => Promise<unknown>;
export async function createRequest(): Promise<Request> {
  let key: { client_email: string; private_key: string };
  if (process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY) key = { client_email: process.env.GSC_CLIENT_EMAIL, private_key: process.env.GSC_PRIVATE_KEY.replace(/\\n/g, "\n") };
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try { key = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")); }
    catch { throw new Error("GOOGLE_APPLICATION_CREDENTIALSのJSONを読めません"); }
  } else throw new Error("既存のGSC認証情報を.env.localに設定してください");
  if (!key.client_email || !key.private_key) throw new Error("認証JSONにclient_email/private_keyがありません");
  const client = new JWT({ email: key.client_email, key: key.private_key, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
  let gaToken: string;
  let gscToken: string;
  try {
    const [ga, gsc] = await Promise.all([client.authorize(), getAccessToken()]);
    if (!ga.access_token) throw new Error("no token");
    gaToken = ga.access_token; gscToken = gsc;
  } catch { throw new Error("GA4/GSCの読み取り認証に失敗しました。権限と接続を確認してください（認証情報は非表示）"); }
  return async (api, endpoint, body) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await fetch(endpoint, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${api === "ga" ? gaToken : gscToken}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
      } catch {
        if (attempt === 2) throw new Error(`${api}: 接続失敗/タイムアウト`);
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt)); continue;
      }
      if (response.ok) return response.json();
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt)); continue;
      }
      throw new Error(`${api}: HTTP ${response.status}（レスポンス本文・認証情報は非表示）`);
    }
    throw new Error(`${api}: 再試行上限`);
  };
}
export const GA_ENDPOINT = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}`;
export const GSC_ENDPOINT = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
export type Spec = { api: "ga" | "gsc"; period: Range; dimensions: string[]; metrics?: string[]; events?: string[] };
export function requestBody(spec: Spec, offset: number): object {
  if (spec.api === "gsc") return { ...spec.period, dimensions: spec.dimensions, type: "web", dataState: "final", rowLimit: 25000, startRow: offset };
  const filters: object[] = [{ filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: HOST } } }];
  if (spec.events) filters.push({ filter: { fieldName: "eventName", inListFilter: { values: spec.events } } });
  return { dateRanges: [spec.period], dimensions: spec.dimensions.map(name => ({ name })), metrics: spec.metrics?.map(name => ({ name })), dimensionFilter: { andGroup: { expressions: filters } }, limit: 100000, offset, ...(spec.dimensions.length ? { orderBys: spec.dimensions.map(dimensionName => ({ dimension: { dimensionName } })) } : {}) };
}
export async function captureReport(request: Request, spec: Spec, maxPages = 10): Promise<Capture> {
  const capture: Capture = { api: spec.api, period: spec.period, dimensions: spec.dimensions, status: "ok", pages: [], request: requestBody(spec, 0) };
  const limit = spec.api === "ga" ? 100000 : 25000;
  try {
    for (let i = 0; i < maxPages; i++) {
      const page = await request(spec.api, spec.api === "ga" ? GA_ENDPOINT + ":runReport" : GSC_ENDPOINT, requestBody(spec, i * limit)) as GaResponse & GscResponse;
      capture.pages.push(page);
      const count = page.rows?.length ?? 0;
      if (count < limit && (spec.api === "gsc" || (page.rowCount ?? 0) <= i * limit + count)) return capture;
      if (spec.api === "ga" && !count) throw new Error("ga: rowCountに対してページングが完了していません");
    }
    capture.status = "truncated"; capture.message = "取得上限に到達。部分取得を0件・完全取得として評価しない。";
  } catch (error) { capture.status = "error"; capture.message = error instanceof Error ? error.message : "API取得失敗"; }
  return capture;
}
