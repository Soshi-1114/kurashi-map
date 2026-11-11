// 令和7年(2025)国勢調査 人口等基本集計（原数値）から、市区町村別の総人口(2025)と
// 5年間(2020→2025)の人口増減率を取得し、data/{pref}.json の
// population と populationTrend を更新する。
// 表IDは versions.mjs。速報と基本集計を混在させず、全件の取得確認後に保存する。
//
// 実行: node --env-file=.env.local scripts/fetch-population-2025.mjs --pref=saitama
//       node --env-file=.env.local scripts/fetch-population-2025.mjs --all

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePrefs, NORTHERN_TERRITORIES_CODES } from "./_lib/prefs.mjs";
import { loadAllMuni, saveMuni } from "./_lib/data.mjs";
import { requireEstatAppId, fetchStatsData } from "./_lib/estat.mjs";
import { version } from "./_lib/versions.mjs";
import { censusValues, populationTrend } from "./_lib/population.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APP_ID = requireEstatAppId();

const POP_2025 = version("POPULATION_STATSDATAID");
const CHG_2025 = version("POPULATION_CHANGE_STATSDATAID");

async function main() {
  // 対象県の全コードへ、同じ全国基本集計2表の結果を配分する。
  const prefs = resolvePrefs(process.argv.slice(2));
  const { entries, byCode, codes } = await loadAllMuni(ROOT, prefs);
  console.log(`対象 ${prefs.length}県 / ${codes.length}自治体 を一括取得`);

  // 基本集計は各表1回で全国取得（総人口4,082地域、増減率4,082地域）。
  const pop2025 = censusValues(await fetchStatsData(APP_ID, POP_2025, {
    cdCat01: "0", cdTime: "2025000000",
  }), { tab: "2025_01", unit: "人" });
  const rate = censusValues(await fetchStatsData(APP_ID, CHG_2025, {
    cdTab: "2025_35", cdTime: "2025000000",
  }), { tab: "2025_35", unit: "％" });
  const missing = codes.filter((code) => !NORTHERN_TERRITORIES_CODES.has(code) &&
    (pop2025.get(code) == null || !rate.has(code)));
  if (missing.length) throw new Error(`人口/増減率が未取得の自治体があります（保存中止）: ${missing.join(",")}`);

  const dist = {};
  let popUpd = 0, trendUpd = 0, miss = 0;
  for (const [code, m] of byCode) {
    if (NORTHERN_TERRITORIES_CODES.has(code)) continue;
    const p = pop2025.get(code);
    if (p != null) { m.population = p; popUpd++; } else miss++;
    const r = rate.get(code);
    const t = r == null ? null : populationTrend(r);
    if (t) {
      m.populationTrend = t;
      // 率そのものも保存（人口増加率ランキング用。trend はこの率の5区分）。
      m.populationChangeRate = r;
      trendUpd++; dist[t] = (dist[t] || 0) + 1;
    } else {
      // 双葉町等、基準人口0で増減率が「-」の公表行は横ばいにしない。
      delete m.populationChangeRate;
      m.populationTrend = "データなし";
    }
  }
  for (const { paths, muni, wards } of entries) await saveMuni(paths, muni, wards);
  console.log(`pop更新${popUpd}/${byCode.size}(欠${miss}) trend${trendUpd} | ${JSON.stringify(dist)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
