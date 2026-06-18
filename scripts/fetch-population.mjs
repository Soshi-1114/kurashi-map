// 令和2年国勢調査 人口等基本集計から、埼玉県全市区町村+10区の総人口を取得し
// data/saitama.json / data/saitama_wards.json の population 値を上書きする。
//
// 実行: node --env-file=.env.local scripts/fetch-population.mjs

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

const STATS_DATA_ID = "0003445078"; // 令和2年国勢調査 人口等基本集計 男女別人口 - 市区町村

// 埼玉県の市区町村コードと区コードを data から取得
async function loadCodes() {
  const muni = JSON.parse(await fs.readFile(path.join(ROOT, "data/saitama.json"), "utf8"));
  const wards = JSON.parse(await fs.readFile(path.join(ROOT, "data/saitama_wards.json"), "utf8"));
  return {
    muni,
    wards,
    allCodes: [...muni.map((m) => m.code), ...wards.map((m) => m.code)],
  };
}

async function fetchPopulationByArea(codes) {
  // e-Stat API は cdArea にカンマ区切りで複数指定可能
  const url = new URL("https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData");
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("statsDataId", STATS_DATA_ID);
  url.searchParams.set("cdArea", codes.join(","));
  url.searchParams.set("cdCat01", "0"); // 男女総数
  url.searchParams.set("limit", "100000");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  const values = data.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];
  const arr = Array.isArray(values) ? values : [values];
  const byCode = new Map();
  for (const v of arr) {
    const code = v["@area"];
    const val = parseInt(v["$"], 10);
    if (!Number.isNaN(val)) byCode.set(code, val);
  }
  return byCode;
}

async function main() {
  const { muni, wards, allCodes } = await loadCodes();
  console.log(`Fetching population for ${allCodes.length} areas...`);
  const byCode = await fetchPopulationByArea(allCodes);
  console.log(`Got ${byCode.size} results`);

  const missing = [];
  function update(list) {
    for (const m of list) {
      const v = byCode.get(m.code);
      if (v == null) {
        missing.push(`${m.code} ${m.name}`);
        continue;
      }
      m.population = v;
      // 人口は実値に。サブ系列の他指標は推計のまま残す
    }
  }
  update(muni);
  update(wards);

  if (missing.length) {
    console.warn("Missing:", missing.join(", "));
  }

  await fs.writeFile(
    path.join(ROOT, "data/saitama.json"),
    JSON.stringify(muni, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(ROOT, "data/saitama_wards.json"),
    JSON.stringify(wards, null, 2) + "\n",
  );

  // サンプル表示
  console.log("\n--- sample ---");
  for (const code of ["11100", "11107", "11203", "11369"]) {
    const v = byCode.get(code);
    const m = [...muni, ...wards].find((x) => x.code === code);
    console.log(`${code} ${m?.name ?? "?"}: ${v?.toLocaleString() ?? "n/a"} 人`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
