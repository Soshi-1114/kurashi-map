// 国立社会保障・人口問題研究所（IPSS）「日本の地域別将来推計人口（令和5(2023)年推計）」
// の結果表 Excel の共通パーサ。結果表1（総人口）と結果表2-1〜2-3（年齢3区分）は
// 同一レイアウトなので、1つの関数で Map<自治体コード, 年次値[]> に変換する。
//
// レイアウト（2026-08 調査時点。fetch-future-population.mjs から利用）:
//   行0-4: タイトル・注記・ヘッダ。データは行5から。
//   列0: 自治体コード（数値。先頭ゼロが落ちるため5桁ゼロ埋めが必要）
//   列1: 市などの別 a=都道府県 / 0=政令市の区(東京23区含む) / 1=政令市 / 2=その他の市
//        / 3=町村 / 9=浜通り地域（福島13市町村の一括推計）
//   列2: 都道府県名 / 列3: 市区町村名
//   列4-10: 2020/2025/2030/2035/2040/2045/2050 の人口（人）
//   列11以降: 指数（2020=100）→ 使わない
//
// 市区町村レベルの行（市などの別 0-3）のみ採用し、都道府県計(a)と浜通り地域(9)は捨てる。

import { NORTHERN_TERRITORIES_CODES } from "./prefs.mjs";

/** 結果表の年次列の並び（列4から）。 */
export const IPSS_YEARS = ["2020", "2025", "2030", "2035", "2040", "2045", "2050"];

const DATA_START_ROW = 5;
const YEAR_START_COL = 4;

/**
 * sheet_to_json({header:1}) の行配列 → Map<5桁コード, number[7]>（2020〜2050）。
 * 市区町村行のみ。値が7年ぶん数値で揃わない行はエラー（欠損を黙って通さない）。
 */
export function parseIpssSheet(rows) {
  const byCode = new Map();
  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r[0] == null) continue;
    const type = r[1];
    if (type === "a" || type === 9 || type === "9") continue; // 都道府県計・浜通り地域
    const code = String(r[0]).padStart(5, "0");
    if (!/^\d{5}$/.test(code)) continue;
    const values = [];
    for (let y = 0; y < IPSS_YEARS.length; y++) {
      const v = r[YEAR_START_COL + y];
      if (typeof v !== "number") {
        throw new Error(`行${i} (${code} ${r[3] ?? ""}) の ${IPSS_YEARS[y]} 年値が数値でない: ${v}`);
      }
      values.push(v);
    }
    byCode.set(code, values);
  }
  return byCode;
}

// ===== 収録対象外の自治体（2026-08 調査で確定） =====

/**
 * 福島県浜通りの13市町村。東日本大震災・原発事故の影響が長期に及ぶため、IPSS は
 * 「浜通り地域」として一括推計しており、市町村別の推計値が存在しない。
 */
export const HAMADORI_CODES = new Set([
  "07204", // いわき市
  "07209", // 相馬市
  "07212", // 南相馬市
  "07541", // 広野町
  "07542", // 楢葉町
  "07543", // 富岡町
  "07544", // 川内村
  "07545", // 大熊町
  "07546", // 双葉町
  "07547", // 浪江町
  "07548", // 葛尾村
  "07561", // 新地町
  "07564", // 飯舘村
]);

// 北方領土の6村は IPSS の推計対象に含まれない（在留外国人統計と同じ扱い）。
// コード集合は prefs.mjs に一元化してある（fetch-foreign-residents.mjs と共有）。
export { NORTHERN_TERRITORIES_CODES };

/**
 * 浜松市の現行区のうち、IPSS の旧区に対応が取れないもの。
 * 浜松市は2024年1月に7区→3区へ再編されたが、IPSS（2023年公表・2020年国勢調査基準）は
 * 旧7区（22131-22137）で推計している。旧北区が中央区と浜名区に分割されたため、
 * 旧区の合算では現行の中央区・浜名区を正確に再構成できない（按分は honesty 方針で不可）。
 */
export const HAMAMATSU_UNMAPPABLE_CODES = new Set([
  "22138", // 浜松市中央区（旧 中・東・西・南区 + 北区の一部）
  "22139", // 浜松市浜名区（旧 浜北区 + 北区の大部分）
]);

/**
 * 現行コード → IPSS 旧コードの読み替え。浜松市天竜区は2024年の区再編で
 * 区域変更なくコードのみ 22137→22140 に変わったため、同一区域として読み替える
 * （按分・推計ではなく、同じ区の改称に伴うコード変更）。
 * 「このデータソースの基準年が2024年再編より古い」ことに由来する読み替えなので、
 * 汎用のコード変換表ではなく IPSS モジュールに閉じる。
 */
export const IPSS_CODE_REMAP = new Map([["22140", "22137"]]);

/** コードに応じた「対象外」センチネルの理由文。対象外でなければ null。 */
export function exclusionReason(code) {
  if (HAMADORI_CODES.has(code)) return "対象外（浜通り地域として一括推計のため市町村別の推計なし）";
  if (NORTHERN_TERRITORIES_CODES.has(code)) return "対象外（北方領土）";
  if (HAMAMATSU_UNMAPPABLE_CODES.has(code)) return "対象外（2024年の区再編前の旧区単位で推計されているため現行区のデータなし）";
  return null;
}
