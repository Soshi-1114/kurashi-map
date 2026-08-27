// ふるなび掲載自治体の内部ID（municipalid）を取得し、JISコード→IDの対応表
// data/furunavi-municipals.json を生成する。
//
// ふるなびの自治体一覧ページ（/Municipal/List/）は、全国の掲載自治体
// （約1,600件）を Vue 用の埋め込み JSON としてサーバーレンダリングしており、
// 1リクエストで全件取れる。CityCode（JISコード）フィールドは常に null のため、
// 都道府県ID（=JIS都道府県番号）+ 自治体名でこちらのデータと突合する。
//
// 用途: 自治体詳細ページのふるさと納税導線（アクセストレード×ふるなび提携）で、
// ふるなび側の自治体ページ /Municipal/Product/Search?municipalid={id} へ
// ディープリンクするため。未掲載の自治体は対応表に載せず、導線を非表示にする
// （掲載がない寄付先へ誤誘導しない）。
//
// 使い方: node scripts/fetch-furunavi-municipals.mjs
// API キー不要。掲載自治体は増減するため、年1回程度の再実行を想定。
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllMuni } from "./_lib/data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST_URL = "https://furunavi.jp/Municipal/List/";
const OUT = path.join(root, "data", "furunavi-municipals.json");

// 「龍ケ崎市／龍ヶ崎市」のような表記ゆれを吸収してから突合する。
function normalizeName(name) {
  return name.replaceAll("ヶ", "ケ").replaceAll("檜", "桧").replaceAll("梼", "檮");
}

const res = await fetch(LIST_URL, {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; KurashiMap data script)" },
});
if (!res.ok) throw new Error(`fetch failed: ${res.status} ${LIST_URL}`);
const html = await res.text();

// 埋め込み JSON から自治体オブジェクトだけを抜き出す。ページ構造の変化で
// 1件も取れなくなったら明示的に失敗させる（空の対応表を黙って書かない）。
const entries = [...html.matchAll(/\{"MunicipalId":\d+,"CityCode":[^}]*\}/g)]
  .map((m) => JSON.parse(m[0]));
if (entries.length < 1000) {
  throw new Error(`抽出件数が異常に少ない（${entries.length}件）。ページ構造が変わった可能性`);
}

const { entries: prefEntries } = await loadAllMuni(root);

// (都道府県番号2桁 + 正規化名) → JISコード。政令市の区は対応表に載せない
// （ふるなびの寄付先は政令市単位。アプリ側で親市のコードを引く）。
const byPrefName = new Map();
for (const { muni } of prefEntries) {
  for (const m of muni) {
    byPrefName.set(`${m.code.slice(0, 2)}:${normalizeName(m.name)}`, m.code);
  }
}

const byCode = {};
const unmatched = [];
for (const e of entries) {
  // 「（道庁）」「（県庁）」のような都道府県そのものの受付窓口はスキップ
  // （本対応表は市区町村ページ用。MunicipalId も 10001 以降の別枠）。
  if (/^（.+）$/.test(e.MunicipalName)) continue;
  const prefCode = String(e.PrefectureId).padStart(2, "0");
  const code = byPrefName.get(`${prefCode}:${normalizeName(e.MunicipalName)}`);
  if (code) byCode[code] = e.MunicipalId;
  else unmatched.push(`${e.PrefectureName}${e.MunicipalName} (municipalid=${e.MunicipalId})`);
}

const sorted = Object.fromEntries(
  Object.entries(byCode).sort(([a], [b]) => a.localeCompare(b)),
);
const out = {
  source: "ふるなび 自治体一覧（furunavi.jp/Municipal/List/）",
  fetchedAt: new Date().toISOString().slice(0, 10),
  byCode: sorted,
};
await fs.writeFile(OUT, JSON.stringify(out, null, 2) + "\n");

console.log(`ふるなび掲載: ${entries.length}件 → 突合成功: ${Object.keys(sorted).length}件`);
if (unmatched.length > 0) {
  console.log(`突合できなかった掲載自治体（${unmatched.length}件・名称ゆれの可能性）:`);
  for (const u of unmatched) console.log(`  - ${u}`);
}
