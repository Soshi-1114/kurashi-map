// 国土数値情報 L01（地価公示）令和7年版から、市区町村別の住宅地平均地価を計算し
// data/saitama.json / saitama_wards.json の landPrice.value を上書きする。
//
// 事前準備:
//   curl -L -o /tmp/L01_saitama.zip https://nlftp.mlit.go.jp/ksj/gml/data/L01/L01-25/L01-25_11_GML.zip
//   unzip -o /tmp/L01_saitama.zip -d /tmp/L01_saitama
//
// 実行: node scripts/fetch-land-price.mjs [path-to-L01.geojson]

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const L01_PATH =
  process.argv[2] ||
  process.env.L01_GEOJSON ||
  "/tmp/L01_saitama/L01-25_11_GML/L01-25_11.geojson";

if (!existsSync(L01_PATH)) {
  console.error(`L01 geojson not found: ${L01_PATH}`);
  console.error("Download: curl -L -o /tmp/L01_saitama.zip https://nlftp.mlit.go.jp/ksj/gml/data/L01/L01-25/L01-25_11_GML.zip && unzip -o /tmp/L01_saitama.zip -d /tmp/L01_saitama");
  process.exit(1);
}

async function loadJson(rel) {
  return JSON.parse(await fs.readFile(path.join(ROOT, rel), "utf8"));
}

async function main() {
  const muni = await loadJson("data/saitama.json");
  const wards = await loadJson("data/saitama_wards.json");

  const raw = JSON.parse(await fs.readFile(L01_PATH, "utf8"));
  console.log(`L01 features: ${raw.features.length}`);

  // 住宅地のみ集計 (L01_010 == 1)
  // L01_001 が市区町村コード（5桁）、L01_008 が当年（2025）価格 [円/m²]
  const groups = new Map(); // code -> [prices]
  let kept = 0;
  for (const f of raw.features) {
    const p = f.properties;
    if (Number(p.L01_010) !== 1) continue; // 住宅地のみ
    const code = String(p.L01_001 ?? "");
    const price = Number(p.L01_008);
    if (!code || !price) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(price);
    kept++;
  }
  console.log(`住宅地ポイント数: ${kept}`);
  console.log(`カバー市区町村+区数: ${groups.size}`);

  const mean = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  // 政令市の親コード (11100=さいたま市) は L01 上に存在しないため、
  // その親に紐づく行政区コードの全ポイントを合算
  const PARENT_TO_WARDS = {
    "11100": ["11101", "11102", "11103", "11104", "11105", "11106", "11107", "11108", "11109", "11110"],
  };

  const missing = [];
  function update(list) {
    for (const m of list) {
      let arr = groups.get(m.code);
      if ((!arr || arr.length === 0) && PARENT_TO_WARDS[m.code]) {
        // 政令市親なら子区を合算
        arr = PARENT_TO_WARDS[m.code].flatMap((c) => groups.get(c) ?? []);
      }
      if (!arr || arr.length === 0) {
        missing.push(`${m.code} ${m.name}`);
        continue;
      }
      m.landPrice = {
        value: mean(arr),
        unit: "円/㎡",
        source: "地価公示（住宅地平均）",
        asOf: "2025",
        isEstimated: false,
      };
    }
  }
  update(muni);
  update(wards);

  if (missing.length) {
    console.warn(`\n地価データ無し (${missing.length}件):`);
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
  for (const code of ["11100", "11103", "11107", "11203", "11369"]) {
    const all = [...muni, ...wards];
    const m = all.find((x) => x.code === code);
    const n = groups.get(code)?.length ?? 0;
    console.log(`${code} ${m?.name ?? "?"}: ${m?.landPrice.value.toLocaleString() ?? "n/a"} 円/㎡ (n=${n})`);
  }
  // さいたま市 11100 は wards に分かれてるため別途集計表示
  const wardCodes = ["11101","11102","11103","11104","11105","11106","11107","11108","11109","11110"];
  const seitamaPrices = wardCodes.flatMap(c => groups.get(c) ?? []);
  if (seitamaPrices.length > 0) {
    console.log(`参考 さいたま市10区合算: ${mean(seitamaPrices).toLocaleString()} 円/㎡ (n=${seitamaPrices.length})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
