import { describe, it, expect } from "vitest";
// @ts-expect-error mjs モジュール（データスクリプト共通ヘルパー）に型定義はない
import {
  IPSS_YEARS,
  parseIpssSheet,
  exclusionReason,
  FUTURE_CODE_REMAP,
  HAMADORI_CODES,
  NORTHERN_TERRITORIES_CODES,
  HAMAMATSU_UNMAPPABLE_CODES,
} from "../../scripts/_lib/ipss.mjs";

// 結果表のレイアウト（行0-4=ヘッダ、行5〜=データ）を模したフィクスチャ。
const header = [
  ["結果表1　総人口および指数"],
  [],
  [],
  ["コード", "市などの別", "都道府県", "市区町村", "総人口（人）"],
  [null, null, null, null, "2020年", "2025年", "2030年", "2035年", "2040年", "2045年", "2050年"],
];

describe("parseIpssSheet", () => {
  it("市区町村行を5桁ゼロ埋めコードで取り込み、7年ぶんの値を返す", () => {
    const rows = [
      ...header,
      [1000, "a", "北海道", null, 5224614, 1, 2, 3, 4, 5, 6], // 都道府県計 → 除外
      [1100, 1, "北海道", "札幌市", 1973395, 1970144, 1949619, 1916129, 1868252, 1809025, 1745608],
      [1101, 0, "北海道", "札幌市中央区", 248680, 257249, 261989, 264270, 263742, 260421, 255587],
      [99999, 9, "福島県", "浜通り地域", 100, 90, 80, 70, 60, 50, 40], // 一括推計 → 除外
    ];
    const map = parseIpssSheet(rows);
    expect(map.size).toBe(2);
    expect(map.get("01100")).toEqual([1973395, 1970144, 1949619, 1916129, 1868252, 1809025, 1745608]);
    expect(map.get("01101")?.[6]).toBe(255587);
    expect(map.has("01000")).toBe(false);
  });

  it("年次値が数値でない行はエラーにする（欠損を黙って通さない）", () => {
    const rows = [...header, [1100, 1, "北海道", "札幌市", 1973395, "－", 0, 0, 0, 0, 0]];
    expect(() => parseIpssSheet(rows)).toThrow(/2025 年値が数値でない/);
  });

  it("IPSS_YEARS は 2020〜2050 の5年刻み7時点", () => {
    expect(IPSS_YEARS).toEqual(["2020", "2025", "2030", "2035", "2040", "2045", "2050"]);
  });
});

describe("exclusionReason", () => {
  it("浜通り13市町村・北方領土6村・浜松2区が対象外", () => {
    expect(HAMADORI_CODES.size).toBe(13);
    expect(NORTHERN_TERRITORIES_CODES.size).toBe(6);
    expect(HAMAMATSU_UNMAPPABLE_CODES.size).toBe(2);
    expect(exclusionReason("07546")).toContain("浜通り"); // 双葉町
    expect(exclusionReason("01695")).toContain("北方領土"); // 色丹村
    expect(exclusionReason("22138")).toContain("区再編"); // 浜松市中央区
    expect(exclusionReason("11203")).toBeNull(); // 川口市
  });

  it("天竜区は対象外ではなく旧コードへの読み替え（区域変更なしの改称のため）", () => {
    expect(exclusionReason("22140")).toBeNull();
    expect(FUTURE_CODE_REMAP.get("22140")).toBe("22137");
  });
});
