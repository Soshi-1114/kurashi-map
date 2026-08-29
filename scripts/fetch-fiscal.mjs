// 総務省「地方公共団体の主要財政指標一覧」の全市町村 Excel から財政力指数を抽出し、
// data/{pref}.json の fiscal に反映する。
//
// 出典の性質（令和6年度版で実ファイル確認済み）:
// - 単一シート「全市町村の主要財政指標」。ヘッダ行 = 「団体コード/都道府県名/団体名/
//   財政力指数/経常収支比率/実質公債費比率/将来負担比率/ラスパイレス指数」。
// - 団体コードは6桁（チェックデジット付き）→ 末尾1桁を落とした5桁が Municipality.code。
// - 政令市は市単位のみ（区の行はない）→ 区へは市の値を source「（○○市全体の値）」付きで
//   展開する（fetch-childcare.mjs と同方式）。
// - 東京23特別区も収録されているが、都区財政調整制度下の算定のため source に明記し、
//   ランキングからは除外する（lib/fiscal.ts isFiscalRankable）。
// - 末尾の「全国市町村平均」行は団体コード列がラベルのため6桁判定で自然に除外。
// - 北方領土6村は出典に行がない → index=-1 センチネル。
// - 列位置は年度で変わり得るため、ヘッダ行の見出し文字列から動的に解決する。
//
// 事前: curl -sL -o /tmp/fiscal.xlsx "<FISCAL_XLSX_URL>"
// 実行: node scripts/fetch-fiscal.mjs --pref=saitama / --all

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePrefs } from "./_lib/prefs.mjs";
import { resolveXlsxPath, readWorkbook, sheetRows } from "./_lib/xlsx.mjs";
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { version } from "./_lib/versions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ASOF = version("FISCAL_ASOF");
const SOURCE = "総務省 地方公共団体の主要財政指標一覧";
// 東京23特別区（13101〜13123）。都区財政調整制度下の算定であることを source に明記する
// （lib/fiscal.ts の isFiscalRankable / isFiscalSpecialWard がこの文言で判定する）。
const SPECIAL_WARD_SOURCE = `${SOURCE}（特別区・都区財政調整制度下の算定）`;
// 出典に行がない自治体（北方領土6村）のセンチネル。指数は正値のみなので -1 が安全。
const NODATA = { index: -1, source: "データなし（対象外）", asOf: "-" };

const prefs = resolvePrefs(process.argv.slice(2));

const XLSX_PATH = resolveXlsxPath("FISCAL_XLSX", "/tmp/fiscal.xlsx");

function isSpecialWard(code5) {
  const n = Number(code5);
  return n >= 13101 && n <= 13123;
}

// Excel 全体を「5桁コード → 財政力指数」と全国平均に読み込む。
function extract() {
  const wb = readWorkbook(XLSX_PATH);
  const rows = sheetRows(wb.Sheets[wb.SheetNames[0]]);

  const headerIdx = rows.findIndex((r) => String(r?.[0] ?? "").trim() === "団体コード");
  if (headerIdx < 0) throw new Error("「団体コード」ヘッダ行が見つかりません（様式変更?）");
  const indexCol = rows[headerIdx].findIndex((c) => String(c ?? "").trim() === "財政力指数");
  if (indexCol < 0) throw new Error("「財政力指数」列が見つかりません（様式変更?）");

  const out = new Map();
  let nationalAvg = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const code6 = String(r[0] ?? "").trim();
    if (code6 === "全国市町村平均") { nationalAvg = r[indexCol]; continue; }
    if (!/^\d{6}$/.test(code6) || typeof r[indexCol] !== "number") continue;
    out.set(code6.slice(0, 5), r[indexCol]);
  }

  // 表構成変更で全国を過小更新する事故を防ぐ（1,741市区町村+23特別区で1,760前後が正常）。
  if (out.size < 1700) throw new Error(`抽出件数が異常に少ない（${out.size} 件）。様式変更を確認してください`);
  console.log(
    `抽出 ${out.size} 団体` +
    (typeof nationalAvg === "number" ? ` / 全国市町村平均 ${nationalAvg}` : ""),
  );
  return out;
}

async function applyPref(pref, byCode5) {
  const { muni, wards, paths } = await loadMuni(ROOT, pref);

  let hit = 0, nodata = 0;
  for (const m of muni) {
    const index = byCode5.get(m.code);
    if (typeof index === "number") {
      m.fiscal = {
        index,
        source: isSpecialWard(m.code) ? SPECIAL_WARD_SOURCE : SOURCE,
        asOf: ASOF,
      };
      hit++;
    } else {
      m.fiscal = { ...NODATA };
      nodata++;
    }
  }

  // 政令市の区: 出典が市単位のため市全体の値を展開（source で市全体と明示）。
  for (const [parent, children] of Object.entries(pref.parentToWards ?? {})) {
    const p = muni.find((m) => m.code === parent);
    if (!p?.fiscal || p.fiscal.index <= 0) continue;
    for (const cc of children) {
      const w = wards.find((x) => x.code === cc);
      if (w) w.fiscal = { ...p.fiscal, source: `${SOURCE}（${p.name}全体の値）` };
    }
  }

  await saveMuni(paths, muni, wards);
  console.log(`${pref.slug}: fiscal ${hit} / データなし ${nodata}`);
}

async function main() {
  const byCode5 = extract();
  for (const pref of prefs) await applyPref(pref, byCode5);
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
