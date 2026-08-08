// 町丁名（大字・町丁目）と自治体の読み仮名データを生成する。
// 検索サジェスト専用のメタデータで、統計値ではない（honesty 方針の対象外だが出典は明記する）。
//
// 出典: Geolonia 住所データ（国土交通省「位置参照情報」等を元に整備・MIT License）
//   https://github.com/geolonia/japanese-addresses
//   ※位置参照情報の一次配布はフォーム経由 zip のため、機械取得できる整備版 CSV を使う。
//
// 使い方:
//   node scripts/fetch-towns.mjs                          # CSV をダウンロードして生成
//   node scripts/fetch-towns.mjs --file=/path/latest.csv  # 取得済みローカル CSV から生成
//
// 出力（いずれも本アプリの data/*.json に収録済みの自治体コードのみに絞る）:
//   data/muni-kana.json … { code: ひらがな読み }。MuniSummary に載せて検索のかな一致に使う。
//     政令市の親市（例 11100 さいたま市）は区の読みの共通接頭辞から導出する（towns.mjs 参照）。
//   data/towns.json     … { code: [[町丁名, ひらがな], ...] }。丁目は大字単位に畳んで重複排除。
//     /api/town-search だけが読むサーバー専用データ（クライアントへは配信しない）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREFS } from "./_lib/prefs.mjs";
import { loadAllMuni } from "./_lib/data.mjs";
import { toHiragana, collapseChome, townKanaToHiragana, cityKanaFromWardKanas, parseCsvLine } from "./_lib/towns.mjs";

const CSV_URL = "https://raw.githubusercontent.com/geolonia/japanese-addresses/master/data/latest.csv";
const SOURCE = "Geolonia 住所データ（国土交通省「位置参照情報」等を元に作成・MIT License）";

// CSV に行が無い自治体の読み仮名の補完（出典: 総務省「全国地方公共団体コード」の読み仮名欄）。
// 対象は ①住所データが無い北方領土6村・大字のない島しょ等 ②浜松市の2024年区再編
// （中央区・浜名区・天竜区の新コード）が CSV に未反映のぶん。統計値ではなく名称の
// 読みという公的事実のため、honesty 方針（推計値の禁止）には抵触しない。
const MANUAL_KANA = {
  "13362": "としまむら",             // 東京都利島村
  "22130": "はままつし",             // 浜松市（親市）
  "22138": "はままつしちゅうおうく", // 浜松市中央区
  "22139": "はままつしはまなく",     // 浜松市浜名区
  "22140": "はままつしてんりゅうく", // 浜松市天竜区
  "43506": "ゆのまえまち",           // 熊本県球磨郡湯前町
  "01695": "しこたんむら",           // 色丹村（北方領土）
  "01696": "とまりむら",             // 泊村（北方領土）
  "01697": "るよべつむら",           // 留夜別村（北方領土）
  "01698": "るべつむら",             // 留別村（北方領土）
  "01699": "しゃなむら",             // 紗那村（北方領土）
  "01700": "しべとろむら",           // 蘂取村（北方領土）
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fileArg = process.argv.find((a) => a.startsWith("--file="))?.slice(7);

async function loadCsv() {
  if (fileArg) {
    console.log(`ローカル CSV を使用: ${fileArg}`);
    return fs.readFileSync(fileArg, "utf8");
  }
  console.log(`ダウンロード中: ${CSV_URL}`);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV の取得に失敗: HTTP ${res.status}`);
  return res.text();
}

// 本アプリに収録済みの自治体コード（市区町村 + 行政区 + 政令市親コード）
async function loadKnownCodes() {
  const { codes } = await loadAllMuni(root);
  return new Set(codes);
}

const csv = await loadCsv();
const known = await loadKnownCodes();

// ヘッダー行から列位置を解決（列順変更に耐える）
const lines = csv.split("\n");
const header = parseCsvLine(lines[0].replace(/^﻿/, "").trimEnd());
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`CSV に列「${name}」が見つからない`);
  return i;
};
const C_CODE = col("市区町村コード");
const C_MUNI_KANA = col("市区町村名カナ");
const C_TOWN = col("大字町丁目名");
const C_TOWN_KANA = col("大字町丁目名カナ");

const muniKana = new Map(); // code -> ひらがな読み
const towns = new Map();    // code -> Map(町丁名 -> ひらがな)
let rows = 0;
let skippedUnknown = 0;

for (let li = 1; li < lines.length; li++) {
  const line = lines[li].trimEnd();
  if (!line) continue;
  const f = parseCsvLine(line);
  const code = f[C_CODE];
  if (!/^\d{5}$/.test(code)) continue;
  rows++;
  if (!known.has(code)) { skippedUnknown++; continue; }

  const mk = f[C_MUNI_KANA];
  if (mk && !muniKana.has(code)) muniKana.set(code, toHiragana(mk));

  const townName = collapseChome((f[C_TOWN] ?? "").trim());
  if (!townName) continue;
  let byName = towns.get(code);
  if (!byName) { byName = new Map(); towns.set(code, byName); }
  const kana = townKanaToHiragana(f[C_TOWN_KANA] ?? "");
  const prev = byName.get(townName);
  if (prev === undefined || (prev === "" && kana)) byName.set(townName, kana);
}

// 政令市の親市の読みを区の読みから導出（位置参照情報に親市の行は無い）
let derivedParents = 0;
for (const pref of Object.values(PREFS)) {
  for (const [parent, wardCodes] of Object.entries(pref.parentToWards)) {
    if (!known.has(parent) || muniKana.has(parent)) continue;
    const derived = cityKanaFromWardKanas(wardCodes.map((c) => muniKana.get(c) ?? ""));
    if (derived) {
      muniKana.set(parent, derived);
      derivedParents++;
    }
  }
}

// CSV に行が無い自治体の読みを補完（既にあるコードには触らない）
let manualUsed = 0;
for (const [code, kana] of Object.entries(MANUAL_KANA)) {
  if (known.has(code) && !muniKana.has(code)) {
    muniKana.set(code, kana);
    manualUsed++;
  }
}

const today = new Date().toISOString().slice(0, 10);
const sortedCodes = (m) => [...m.keys()].sort();

// muni-kana.json（1行1自治体で diff を読みやすく）
{
  const body = sortedCodes(muniKana)
    .map((c) => `    ${JSON.stringify(c)}: ${JSON.stringify(muniKana.get(c))}`)
    .join(",\n");
  const out = `{
  "source": ${JSON.stringify(SOURCE)},
  "url": "https://github.com/geolonia/japanese-addresses",
  "asOf": ${JSON.stringify(today)},
  "generatedBy": "scripts/fetch-towns.mjs",
  "kana": {
${body}
  }
}
`;
  fs.writeFileSync(path.join(root, "data", "muni-kana.json"), out);
}

// towns.json（1行1自治体。町丁は [名前, ひらがな] のタプル配列）
{
  const body = sortedCodes(towns)
    .map((c) => {
      const list = [...towns.get(c).entries()].map(([n, k]) => JSON.stringify([n, k])).join(",");
      return `    ${JSON.stringify(c)}: [${list}]`;
    })
    .join(",\n");
  const out = `{
  "source": ${JSON.stringify(SOURCE)},
  "url": "https://github.com/geolonia/japanese-addresses",
  "asOf": ${JSON.stringify(today)},
  "generatedBy": "scripts/fetch-towns.mjs",
  "towns": {
${body}
  }
}
`;
  fs.writeFileSync(path.join(root, "data", "towns.json"), out);
}

const townCount = [...towns.values()].reduce((s, m) => s + m.size, 0);
console.log(`CSV ${rows} 行を処理（収録外コードのスキップ ${skippedUnknown} 行）`);
console.log(`muni-kana.json: ${muniKana.size} 自治体（親市の導出 ${derivedParents} 件・総務省コード表からの補完 ${manualUsed} 件）`);
console.log(`towns.json: ${towns.size} 自治体 / ${townCount} 町丁`);
