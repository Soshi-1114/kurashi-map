// 令和5年住宅・土地統計調査「住宅及び世帯総数 居住世帯の有無(8区分)別住宅数
// －全国、都道府県、市区町村」(statsDataId 0004021421) から **都道府県別** の
// 住宅総数(cat01=0)と空き家数(cat01=22)を取得し、data/vacancy-pref.json に保存する。
//
// なぜ市区町村の合算ではなく都道府県表を引くのか（重要）:
//   同じ調査でも市区町村別集計は人口1.5万人未満の町村を含まない。それらは空き家率の
//   高い過疎地に偏るため、市区町村を合算すると系統的に低く出て、総務省公表の順位と
//   食い違う（徳島 21.24% / 和歌山 21.17% が 20.4% / 20.7% になり **1位が逆転**した）。
//   都道府県表は県全体を対象にした公表値なので、この歪みが無い。
//   判断基準は lib/prefRankings.ts 冒頭のコメントを参照。
//
// 市区町村別の空き家率は fetch-vacancy.mjs が別に取得する（用途が違うので両方必要）。
//
// 実行: node --env-file=.env.local scripts/fetch-vacancy-pref.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREFS } from "./_lib/prefs.mjs";
import { requireEstatAppId } from "./_lib/estat.mjs";
import { fetchHousingCounts, HOUSING_AS_OF } from "./_lib/housingStats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "vacancy-pref.json");

const APP_ID = requireEstatAppId();

// 表ID・カテゴリコード・基準年は scripts/_lib/housingStats.mjs に集約（市区町村版と共有）。
const SOURCE = "住宅・土地統計調査（居住世帯の有無別住宅数・都道府県）";
const AS_OF = HOUSING_AS_OF;
// e-Stat の地域コードは都道府県が5桁ゼロ埋め（北海道=01000 … 沖縄=47000）。
// scripts/_lib/prefs.mjs の PREFS は slug をキーにしたオブジェクトで、県コードは `code`。
const PREF_LIST = Object.entries(PREFS).map(([slug, p]) => ({ slug, code: p.code }));
const areaCodeOf = (code) => `${code}000`;

async function main() {
  const codes = PREF_LIST.map((p) => areaCodeOf(p.code));
  console.log(`都道府県 ${codes.length}件の空き家数を取得...`);
  const byArea = await fetchHousingCounts(APP_ID, codes);

  const prefs = {};
  const missing = [];
  let natVacant = 0;
  let natTotal = 0;
  for (const p of PREF_LIST) {
    const c = byArea.get(areaCodeOf(p.code));
    if (!c || !(c.total > 0)) {
      missing.push(p.slug);
      continue;
    }
    prefs[p.slug] = {
      rate: Math.round((c.vacant / c.total) * 10000) / 100, // 小数2桁（公表は小数2桁）
      vacant: c.vacant,
      total: c.total,
    };
    natVacant += c.vacant;
    natTotal += c.total;
  }

  // 都道府県表は全県が揃うはず。欠けたら取得側の問題なので落とす（0で埋めない）。
  if (missing.length > 0) {
    throw new Error(`都道府県データが取得できませんでした: ${missing.join(",")}`);
  }

  const ranked = Object.entries(prefs).sort((a, b) => b[1].rate - a[1].rate);
  console.log(`全国合計: 空き家 ${natVacant.toLocaleString()} / 住宅総数 ${natTotal.toLocaleString()}` +
    `（率 ${((natVacant / natTotal) * 100).toFixed(2)}% — 公表の全国13.8%と一致することを確認）`);
  console.log("上位5県:", ranked.slice(0, 5).map(([s, v]) => `${s} ${v.rate}%`).join(" / "));
  console.log("下位3県:", ranked.slice(-3).map(([s, v]) => `${s} ${v.rate}%`).join(" / "));

  fs.writeFileSync(OUT, `${JSON.stringify({ source: SOURCE, asOf: AS_OF, prefs }, null, 2)}\n`);
  console.log(`保存: ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
