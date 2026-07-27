import { describe, it, expect } from "vitest";
import { hasVacancy, vacancyRateText } from "@/lib/vacancy";
import { getRankingBySlug, rankBy } from "@/lib/rankings";
import { muni } from "../_fixtures";

const vac = (rate: number, vacant = 100, total = 1000) => ({
  rate,
  vacant,
  total,
  source: "住宅・土地統計調査（居住世帯の有無別住宅数）",
  asOf: "2023",
});

const EXCLUDED = { rate: -1, vacant: 0, total: 0, source: "データなし（住宅統計の集計対象外）", asOf: "-" };

describe("hasVacancy", () => {
  it("実データ（rate>=0 かつ total>0）のみ true", () => {
    expect(hasVacancy(vac(13.8))).toBe(true);
    expect(hasVacancy(vac(0))).toBe(true); // 空き家率0%は実データ
  });
  it("対象外センチネル（rate=-1）と未収録（undefined）は false", () => {
    expect(hasVacancy(EXCLUDED)).toBe(false);
    expect(hasVacancy(undefined)).toBe(false);
  });
});

describe("vacancyRateText", () => {
  it("小数1桁の%表記", () => {
    expect(vacancyRateText(vac(13.8))).toBe("13.8%");
    expect(vacancyRateText(vac(9))).toBe("9.0%");
  });
});

describe("vacancy ランキング", () => {
  const high = getRankingBySlug("vacancy-high")!;
  const low = getRankingBySlug("vacancy-low")!;

  const list = [
    muni({ code: "A", vacancy: vac(20.5) }),
    muni({ code: "B", vacancy: vac(8.2) }),
    muni({ code: "C", vacancy: EXCLUDED }), // 対象外→除外
    muni({ code: "D" }), // vacancy 未収録→除外
    muni({ code: "E", vacancy: vac(13.8) }),
  ];

  it("vacancy-high は空き家率降順、対象外・未収録は除外", () => {
    expect(rankBy(high, list).map((m) => m.code)).toEqual(["A", "E", "B"]);
  });

  it("vacancy-low は空き家率昇順", () => {
    expect(rankBy(low, list).map((m) => m.code)).toEqual(["B", "E", "A"]);
  });

  it("display は%表記", () => {
    expect(high.display(list[0])).toBe("20.5%");
  });
});
