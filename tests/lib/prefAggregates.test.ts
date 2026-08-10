import { describe, it, expect, beforeAll } from "vitest";
import { buildPrefMetricSummaries, type PrefMetricSummary } from "@/lib/prefAggregates";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { RANKINGS } from "@/lib/rankings";
import { muni, metric } from "../_fixtures";

describe("buildPrefMetricSummaries", () => {
  it("県内中央値と、その中央値で並べた全国順位を返す", () => {
    // 2県 × 3自治体。家賃の中央値は A県=50,000／B県=30,000 になる。
    const all = [
      muni({ code: "11201", pref: "saitama", rent: metric({ value: 40000 }) }),
      muni({ code: "11202", pref: "saitama", rent: metric({ value: 50000 }) }),
      muni({ code: "11203", pref: "saitama", rent: metric({ value: 60000 }) }),
      muni({ code: "12201", pref: "chiba", rent: metric({ value: 20000 }) }),
      muni({ code: "12202", pref: "chiba", rent: metric({ value: 30000 }) }),
      muni({ code: "12203", pref: "chiba", rent: metric({ value: 40000 }) }),
    ];
    const byPref = buildPrefMetricSummaries(all);
    const saitamaRent = byPref.get("saitama")?.find((s) => s.slug === "rent-high");
    const chibaRent = byPref.get("chiba")?.find((s) => s.slug === "rent-high");

    expect(saitamaRent?.valueText).toBe("50,000円/月");
    expect(chibaRent?.valueText).toBe("30,000円/月");
    // 高い順なので中央値50,000の埼玉が1位、30,000の千葉が2位
    expect(saitamaRent?.rank).toBe(1);
    expect(chibaRent?.rank).toBe(2);
    expect(saitamaRent?.total).toBe(2);
  });

  it("中央値に当たる自治体名を持つ（どの街の値かを示すため）", () => {
    const all = [
      muni({ code: "11201", pref: "saitama", name: "低", rent: metric({ value: 40000 }) }),
      muni({ code: "11202", pref: "saitama", name: "中", rent: metric({ value: 50000 }) }),
      muni({ code: "11203", pref: "saitama", name: "高", rent: metric({ value: 60000 }) }),
    ];
    expect(
      buildPrefMetricSummaries(all).get("saitama")?.find((s) => s.slug === "rent-high")?.medianMuniName,
    ).toBe("中");
  });

  it("該当データが無い県はその指標を持たない（推計で埋めない）", () => {
    const all = [
      muni({ code: "11201", pref: "saitama", rent: metric({ value: 40000 }) }),
      // 家賃データなし（住宅統計の集計対象外の小町村相当）
      muni({ code: "12201", pref: "chiba", rent: metric({ value: 0 }) }),
    ];
    const byPref = buildPrefMetricSummaries(all);
    expect(byPref.get("saitama")?.some((s) => s.slug === "rent-high")).toBe(true);
    expect(byPref.get("chiba")?.some((s) => s.slug === "rent-high")).toBeFalsy();
  });

  it("政令市の行政区は集計から除外する（親市との二重計上を避ける）", () => {
    const all = [
      muni({ code: "11100", pref: "saitama", name: "さいたま市", rent: metric({ value: 60000 }) }),
      muni({ code: "11101", pref: "saitama", name: "西区", level: "ward", parentCode: "11100", rent: metric({ value: 10000 }) }),
    ];
    // 区が除外されるので中央値は親市の 60,000 のまま
    expect(
      buildPrefMetricSummaries(all).get("saitama")?.find((s) => s.slug === "rent-high")?.valueText,
    ).toBe("60,000円/月");
  });
});

describe("buildPrefMetricSummaries（実データ）", () => {
  // 全自治体の集計は重いので1度だけ実行して共有する。
  let byPref: Map<string, PrefMetricSummary[]>;
  beforeAll(async () => {
    byPref = buildPrefMetricSummaries(await listAllAcrossPrefs());
  });

  it("東京都は家賃・地価・人口密度の中央値が全国1位になる", () => {
    const tokyo = byPref.get("tokyo") ?? [];
    for (const slug of ["rent-high", "land-price-high", "population-density"]) {
      expect(tokyo.find((s) => s.slug === slug)?.rank).toBe(1);
    }
  });

  it("概況の指標は RANKINGS の prefSummary フラグから導出する（slug 変更で静かに欠落しない）", () => {
    const expected = RANKINGS.filter((r) => r.prefSummary);
    expect(expected.length).toBeGreaterThan(0);
    expect(byPref.get("tokyo")).toEqual(
      expected.map((r) => expect.objectContaining({ slug: r.slug, label: r.columnLabel })),
    );
  });

  it("全都道府県が指標を持ち、順位は1..総数の範囲に収まる", () => {
    expect(byPref.size).toBe(47);
    for (const summaries of byPref.values()) {
      expect(summaries.length).toBeGreaterThan(0);
      for (const s of summaries) {
        expect(s.rank).toBeGreaterThanOrEqual(1);
        expect(s.rank).toBeLessThanOrEqual(s.total);
      }
    }
  });
});
