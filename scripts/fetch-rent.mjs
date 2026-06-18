// 令和5年住宅・土地統計調査から、市区町村別の家賃分布を取得し、
// 加重平均で「平均家賃」を計算して data/saitama.json / saitama_wards.json
// の rent.value を上書きする。
//
// 実行: node --env-file=.env.local scripts/fetch-rent.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APP_ID = process.env.ESTAT_APP_ID;
if (!APP_ID) {
  console.error("ESTAT_APP_ID が未設定");
  process.exit(1);
}

// 令和5年住宅・土地統計調査
// "借家の家賃 住宅の１か月当たり家賃(10区分)別居住室の畳数(6区分)別借家数 - 市区町村"
const STATS_DATA_ID = "0004021470";

// 家賃区分 (cat01) のミッドポイント。0円・不詳は除外。
// 上限なしの "200,000円以上" は経験的に 220,000 とする（保守的）
const RENT_BIN_MIDPOINT = {
  "02": 5000,    // 1〜10,000円
  "03": 15000,   // 10,000〜20,000円
  "04": 30000,   // 20,000〜40,000円
  "05": 50000,   // 40,000〜60,000円
  "06": 70000,   // 60,000〜80,000円
  "07": 90000,   // 80,000〜100,000円
  "08": 125000,  // 100,000〜150,000円
  "09": 175000,  // 150,000〜200,000円
  "10": 220000,  // 200,000円以上
};

async function loadJson(rel) {
  return JSON.parse(await fs.readFile(path.join(ROOT, rel), "utf8"));
}

async function fetchDistribution(codes) {
  const url = new URL("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData");
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("statsDataId", STATS_DATA_ID);
  url.searchParams.set("cdArea", codes.join(","));
  url.searchParams.set("cdCat02", "0"); // 居住室畳数 総数
  url.searchParams.set("limit", "100000");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const values = data.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];
  const arr = Array.isArray(values) ? values : [values];
  // 地域 × 家賃区分 で集約
  const byArea = new Map(); // code -> Map(catCode -> count)
  for (const v of arr) {
    const area = v["@area"];
    const cat = v["@cat01"];
    const raw = v["$"];
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) continue;
    if (!byArea.has(area)) byArea.set(area, new Map());
    byArea.get(area).set(cat, n);
  }
  return byArea;
}

function weightedMean(distribution) {
  let weighted = 0;
  let total = 0;
  for (const [cat, count] of distribution) {
    const mid = RENT_BIN_MIDPOINT[cat];
    if (mid == null) continue;
    weighted += mid * count;
    total += count;
  }
  if (total === 0) return null;
  return Math.round(weighted / total);
}

async function main() {
  const muni = await loadJson("data/saitama.json");
  const wards = await loadJson("data/saitama_wards.json");
  const allCodes = [...muni.map((m) => m.code), ...wards.map((m) => m.code)];

  console.log(`Fetching rent distribution for ${allCodes.length} areas...`);
  const byArea = await fetchDistribution(allCodes);
  console.log(`Got distribution for ${byArea.size} areas`);

  const missing = [];
  function update(list) {
    for (const m of list) {
      const dist = byArea.get(m.code);
      const mean = dist ? weightedMean(dist) : null;
      if (mean == null) {
        missing.push(`${m.code} ${m.name}`);
        continue;
      }
      m.rent = {
        value: mean,
        unit: "円/月",
        source: "住宅・土地統計調査（加重平均）",
        asOf: "2023",
        isEstimated: false,
      };
    }
  }
  update(muni);
  update(wards);

  if (missing.length) {
    console.warn(`\nMissing rent data for ${missing.length} areas:`);
    console.warn(missing.join(", "));
  }

  await fs.writeFile(
    path.join(ROOT, "data/saitama.json"),
    JSON.stringify(muni, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(ROOT, "data/saitama_wards.json"),
    JSON.stringify(wards, null, 2) + "\n",
  );

  console.log("\n--- sample ---");
  for (const code of ["11100", "11107", "11203", "11369"]) {
    const all = [...muni, ...wards];
    const m = all.find((x) => x.code === code);
    console.log(`${code} ${m?.name ?? "?"}: ${m?.rent.value.toLocaleString() ?? "n/a"} 円/月`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
