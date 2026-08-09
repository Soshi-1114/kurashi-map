import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { searchTownIndex } from "@/lib/townSearch";

const INDEX = [
  { code: "40220", town: "日の里", kana: "ひのさと" },
  { code: "40220", town: "赤間", kana: "あかま" },
  { code: "40220", town: "赤間駅前", kana: "あかまえきまえ" },
  { code: "11203", town: "朝日", kana: "あさひ" },
  { code: "13104", town: "西新宿", kana: "にししんじゅく" },
  { code: "01101", town: "大字なし町", kana: "" },
];

describe("searchTownIndex", () => {
  it("町丁名の部分一致で自治体コードを返す", () => {
    expect(searchTownIndex(INDEX, "日の里")).toEqual([{ code: "40220", town: "日の里" }]);
    expect(searchTownIndex(INDEX, "新宿")).toEqual([{ code: "13104", town: "西新宿" }]);
  });

  it("ひらがな・カタカナの読みでも一致する", () => {
    expect(searchTownIndex(INDEX, "ひのさと")).toEqual([{ code: "40220", town: "日の里" }]);
    expect(searchTownIndex(INDEX, "ヒノサト")).toEqual([{ code: "40220", town: "日の里" }]);
  });

  it("同じ自治体は最上位の1町丁に集約する", () => {
    // 赤間・赤間駅前の両方が前方一致するが、宗像市として1行に集約される
    expect(searchTownIndex(INDEX, "赤間")).toEqual([{ code: "40220", town: "赤間" }]);
  });

  it("前方一致を部分一致より優先する", () => {
    const idx = [
      { code: "11201", town: "南朝日", kana: "みなみあさひ" },
      { code: "11203", town: "朝日", kana: "あさひ" },
    ];
    expect(searchTownIndex(idx, "朝日")[0]).toEqual({ code: "11203", town: "朝日" });
  });

  it("2文字未満のクエリと limit を尊重する", () => {
    expect(searchTownIndex(INDEX, "赤")).toEqual([]);
    expect(searchTownIndex(INDEX, "  ")).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) => ({ code: String(10000 + i), town: `朝日${i}`, kana: "" }));
    expect(searchTownIndex(many, "朝日", 8)).toHaveLength(8);
  });

  it("読みが空の町丁はかな検索でヒットしない（名前では引ける）", () => {
    expect(searchTownIndex(INDEX, "おおあざ")).toEqual([]);
    expect(searchTownIndex(INDEX, "大字なし")).toEqual([{ code: "01101", town: "大字なし町" }]);
  });
});

describe("実データ（data/towns.json・data/muni-kana.json）", () => {
  it("「日の里」で宗像市（40220）が引ける", () => {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/towns.json"), "utf8"));
    const index = Object.entries(raw.towns as Record<string, [string, string][]>).flatMap(([code, list]) =>
      list.map(([town, kana]) => ({ code, town, kana })),
    );
    expect(searchTownIndex(index, "日の里")[0]).toEqual({ code: "40220", town: "日の里" });
    expect(searchTownIndex(index, "ひのさと")[0]).toEqual({ code: "40220", town: "日の里" });
  });

  it("宗像市の読みは「むなかたし」（むなかた で一致できる）", () => {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/muni-kana.json"), "utf8"));
    expect(raw.kana["40220"]).toBe("むなかたし");
    // 政令市の親市（区の読みからの導出分）
    expect(raw.kana["11100"]).toBe("さいたまし");
    expect(raw.kana["23100"]).toBe("なごやし");
  });
});
