import { describe, it, expect } from "vitest";
import { buildFuture2050Insights, buildCapacityItems } from "@/lib/future2050";
import { muni, futurePop } from "../_fixtures";

// 「2050年の暮らし」ビューの派生テキスト。決定論生成・推計明記・欠損は行ごと省略
// （honesty 方針）を守る。
describe("buildFuture2050Insights", () => {
  const ageStats = {
    young: 60_000, elderly: 180_000, total: 600_000,
    source: "総務省 住民基本台帳に基づく人口・世帯数調査（総計・外国人住民含む）",
    asOf: "2026-01-01",
  };

  it("高齢者比率を「およそX人に1人」へ翻訳し、推計を明記する", () => {
    // elderly2050=180,000 / 2050計580,000 ≈ 31.0% → およそ3人に1人
    const m = muni({ futurePopulation: futurePop(), ageStats });
    const lines = buildFuture2050Insights(m);
    expect(lines[0]).toContain("3人に1人");
    expect(lines[0]).toContain("推計");
  });

  it("生産年齢の行は現在値（住基）があれば基準を明記して並記する", () => {
    const m = muni({ futurePopulation: futurePop(), ageStats });
    const working = lines(m).find((s) => s.includes("働き手世代"))!;
    expect(working).toContain("住民基本台帳");
    expect(working).toContain("調査基準が異なる");
    // 現在の生産年齢比率 = 100 - 30(高齢) - 10(年少) = 60.0%
    expect(working).toContain("60.0%");
  });

  it("ageStats が無い場合は並記なしで成立し、推計対象外は空配列", () => {
    const noAge = muni({ futurePopulation: futurePop() });
    const working = lines(noAge).find((s) => s.includes("働き手世代"))!;
    expect(working).not.toContain("住民基本台帳");
    const excluded = muni({ futurePopulation: futurePop({ source: "対象外（浜通り地域）", base2020: 0 }) });
    expect(buildFuture2050Insights(excluded)).toEqual([]);
  });

  function lines(m: ReturnType<typeof muni>) {
    return buildFuture2050Insights(m);
  }
});

describe("buildCapacityItems", () => {
  const averages = { fiscalIndex: 0.49, vacancyRate: 15.7 };

  it("財政・保育・空き家の現況を実データがある指標だけ返す", () => {
    const m = muni({
      fiscal: { index: 0.94, source: "総務省 地方公共団体の主要財政指標一覧", asOf: "2024年度" },
      childcare: {
        capacity: 1000, enrolled: 900, capacityAge0: 100, enrolledAge0: 90,
        capacityAge12: 300, enrolledAge12: 280, hiddenWaitlist: 5,
        source: "こども家庭庁", asOf: "2026-04-01",
      },
      vacancy: { rate: 8.2, vacant: 100, total: 1200, source: "住宅・土地統計調査", asOf: "2023" },
    });
    const items = buildCapacityItems(m, averages);
    expect(items.map((i) => i.label)).toEqual(["財政力指数", "保育の定員余裕率", "空き家率"]);
    expect(items[0].value).toBe("0.94");
    expect(items[0].note).toContain("0.49");
    expect(items[1].value).toBe("10.0%");
    expect(items[2].value).toBe("8.2%");
  });

  it("特別区（都区財政調整）の財政は出さない（財政カードの注記に委ねる）", () => {
    const m = muni({
      fiscal: {
        index: 0.85,
        source: "総務省 地方公共団体の主要財政指標一覧（特別区・都区財政調整制度下の算定）",
        asOf: "2024年度",
      },
    });
    expect(buildCapacityItems(m, averages).some((i) => i.label === "財政力指数")).toBe(false);
  });

  it("データのない指標は行ごと省略（欠損を推計しない）", () => {
    expect(buildCapacityItems(muni({}), averages)).toEqual([]);
  });
});
