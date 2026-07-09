import { describe, it, expect } from "vitest";
import { getRankingBySlug, muniLevelOnly, rankBy, RANKINGS } from "@/lib/rankings";
import { muni, metric } from "../_fixtures";

describe("muniLevelOnly", () => {
  it("政令市の行政区(level:ward)を除外し、市区町村のみ返す", () => {
    const all = [
      muni({ code: "11100", name: "さいたま市" }),
      muni({ code: "11101", name: "西区", level: "ward", parentCode: "11100" }),
      muni({ code: "13103", name: "港区" }), // level未指定=muni（東京特別区）
    ];
    expect(muniLevelOnly(all).map((m) => m.code)).toEqual(["11100", "13103"]);
  });
});

describe("rankBy", () => {
  const cheap = getRankingBySlug("rent-cheap")!;
  const high = getRankingBySlug("rent-high")!;

  const list = [
    muni({ code: "A", rent: metric({ value: 70000 }) }),
    muni({ code: "B", rent: metric({ value: 40000 }) }),
    muni({ code: "C", rent: metric({ value: 0 }) }), // データなし→除外
    muni({ code: "D", rent: metric({ value: 55000 }) }),
  ];

  it("rent-cheap は家賃昇順、データなしは除外", () => {
    expect(rankBy(cheap, list).map((m) => m.code)).toEqual(["B", "D", "A"]);
  });

  it("rent-high は家賃降順", () => {
    expect(rankBy(high, list).map((m) => m.code)).toEqual(["A", "D", "B"]);
  });

  it("limit で上位のみ返す", () => {
    expect(rankBy(cheap, list, 2).map((m) => m.code)).toEqual(["B", "D"]);
  });
});

describe("waitlist-zero ランキング", () => {
  const def = getRankingBySlug("waitlist-zero")!;

  it("待機児童0かつ公表ありのみ対象、人口降順", () => {
    const list = [
      muni({ code: "Z1", population: 100000, waitlistChildren: metric({ value: 0, unit: "人" }) }),
      muni({ code: "Z2", population: 300000, waitlistChildren: metric({ value: 0, unit: "人" }) }),
      muni({ code: "W", population: 500000, waitlistChildren: metric({ value: 5, unit: "人" }) }), // 待機児童あり→除外
      muni({
        code: "U",
        population: 900000,
        waitlistChildren: metric({ value: 0, unit: "人", source: "区別非公表（さいたま市全体で10人）" }),
      }), // 非公表→除外
    ];
    expect(rankBy(def, list).map((m) => m.code)).toEqual(["Z2", "Z1"]);
  });
});

describe("外国人住民比率ランキング", () => {
  const high = getRankingBySlug("foreign-ratio-high")!;
  const low = getRankingBySlug("foreign-ratio-low")!;

  // population=10000 固定で比率 r(%) を作る。
  const at = (code: string, ratioPct: number, partial = {}) =>
    muni({
      code,
      population: 10000,
      foreignResidents: metric({
        value: Math.round((ratioPct / 100) * 10000),
        unit: "人",
        source: "出入国在留管理庁 在留外国人統計",
      }),
      ...partial,
    });

  const list = [
    at("A", 5),
    at("B", 1),
    at("C", 3),
    at("X", 9, {
      foreignResidents: metric({ value: 100, source: "対象外（北方領土）" }),
    }), // 対象外→除外
  ];

  it("high は比率降順、対象外は除外", () => {
    expect(rankBy(high, list).map((m) => m.code)).toEqual(["A", "C", "B"]);
  });

  it("low は比率昇順、対象外は除外", () => {
    expect(rankBy(low, list).map((m) => m.code)).toEqual(["B", "C", "A"]);
  });

  it("display は人口比を小数2桁の%で出す", () => {
    expect(high.display(at("A", 5))).toBe("5.00%");
  });

  it("metaDescription は1位の名前・比率・基準年を含む（実データ算出）", () => {
    const desc = high.metaDescription!(at("A", 5));
    expect(desc).toContain("5.00%");
    expect(desc).toContain("在留外国人統計");
    const none = high.metaDescription!(null);
    expect(none).toContain("外国人住民比率");
  });
});

describe("population-growth ランキング", () => {
  const def = getRankingBySlug("population-growth")!;

  it("増減率の降順、率なし・人口0は除外", () => {
    const list = [
      muni({ code: "A", population: 10000, populationChangeRate: 2.5 }),
      muni({ code: "B", population: 10000, populationChangeRate: -3.1 }),
      muni({ code: "C", population: 10000, populationChangeRate: 7.2 }),
      muni({ code: "N", population: 10000 }), // 率なし（北方領土等）→除外
    ];
    expect(rankBy(def, list).map((m) => m.code)).toEqual(["C", "A", "B"]);
  });

  it("display は符号付き小数1桁の%", () => {
    expect(def.display(muni({ populationChangeRate: 7.25 }))).toBe("+7.3%");
    expect(def.display(muni({ populationChangeRate: -3.14 }))).toBe("-3.1%");
  });
});

describe("land-price-low ランキング", () => {
  const def = getRankingBySlug("land-price-low")!;

  it("地価の昇順、対象外は除外", () => {
    const list = [
      muni({ code: "A", landPrice: metric({ value: 50000 }) }),
      muni({ code: "B", landPrice: metric({ value: 12000 }) }),
      muni({ code: "X", landPrice: metric({ value: 0 }) }), // 標準地なし→除外
    ];
    expect(rankBy(def, list).map((m) => m.code)).toEqual(["B", "A"]);
  });
});

describe("RANKINGS レジストリ", () => {
  it("slug は一意", () => {
    const slugs = RANKINGS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
