import { describe, it, expect } from "vitest";
import { buildPrefHazardRows, summarizePrefHazard } from "@/lib/prefHazardTable";
import { muni, hazard } from "../_fixtures";

// この一覧の要は「選別しないこと」。リスクの低い自治体を抜き出すと、それは安全性ではなく
// 浸水想定区域の指定状況を映してしまう（沖縄63%が該当する一方、埼玉・千葉など19県は0件）。
// また洪水0でも津波レベル7〜8の離島があるため、単一指標での抽出は誤読を生む。
describe("buildPrefHazardRows", () => {
  it("全自治体を行政コード順で返す（リスクの大小で並べ替えない）", () => {
    const rows = buildPrefHazardRows([
      muni({ code: "13103", name: "C市", hazard: hazard({ floodLevel: 6 }) }),
      muni({ code: "13101", name: "A市", hazard: hazard({ floodLevel: 0 }) }),
      muni({ code: "13102", name: "B市", hazard: hazard({ floodLevel: 3 }) }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["A市", "B市", "C市"]);
  });

  it("洪水が0でも津波の想定は別列にそのまま出る（単一指標で安全と見せない）", () => {
    // 大島町・八丈町のような離島の実例: 洪水0・津波レベル7
    const rows = buildPrefHazardRows([
      muni({
        code: "13361",
        name: "大島町",
        hazard: hazard({ floodLevel: 0, tsunamiLevel: 7, tsunamiDepth: "10m以上 ～ 20m未満" }),
      }),
    ]);
    expect(rows[0].flood).toBe("浸水なし");
    expect(rows[0].tsunami).toContain("10m以上");
    expect(rows[0].riskCount).toBe(1); // 津波のぶんだけ数える
  });

  it("評価対象外は全列が「対象外」になる（想定なしと混同させない）", () => {
    const rows = buildPrefHazardRows([
      muni({
        code: "01695",
        name: "色丹村",
        hazard: hazard({ source: "対象外（北方領土・ハザード評価対象外）" }),
      }),
    ]);
    expect(rows[0].evaluated).toBe(false);
    expect([rows[0].flood, rows[0].landslide, rows[0].tsunami, rows[0].stormSurge]).toEqual([
      "対象外", "対象外", "対象外", "対象外",
    ]);
    expect(rows[0].riskCount).toBe(0);
  });

  it("内陸（津波・高潮が -1）は「対象外」、想定0は「想定なし」と書き分ける", () => {
    const rows = buildPrefHazardRows([
      muni({
        code: "11201",
        hazard: hazard({ floodLevel: 2, landslideLevel: 0, tsunamiLevel: -1, stormSurgeLevel: 0 }),
      }),
    ]);
    expect(rows[0].tsunami).toBe("対象外");   // 内陸＝評価の対象そのものが無い
    expect(rows[0].stormSurge).toBe("想定なし"); // 評価済みで想定が無い
  });

  it("riskCount は「想定あり」の指標数（対象外は数えない）", () => {
    const rows = buildPrefHazardRows([
      muni({
        code: "11202",
        hazard: hazard({ floodLevel: 3, landslideLevel: 2, tsunamiLevel: -1, stormSurgeLevel: -1 }),
      }),
    ]);
    expect(rows[0].riskCount).toBe(2);
  });

  it("表示名は displayName を優先する（政令市の区）", () => {
    const rows = buildPrefHazardRows([
      muni({ code: "11101", name: "西区", displayName: "さいたま市西区" }),
    ]);
    expect(rows[0].name).toBe("さいたま市西区");
  });
});

describe("summarizePrefHazard", () => {
  it("総数・評価済み数・想定あり数を実数で返す（断定的な要約はしない）", () => {
    const rows = buildPrefHazardRows([
      muni({ code: "11201", hazard: hazard({ floodLevel: 3 }) }),
      muni({ code: "11202", hazard: hazard({ floodLevel: 0 }) }),
      muni({ code: "11203", hazard: hazard({ source: "対象外（テスト）" }) }),
    ]);
    expect(summarizePrefHazard(rows)).toEqual({ total: 3, evaluated: 2, anyRisk: 1 });
  });
});
