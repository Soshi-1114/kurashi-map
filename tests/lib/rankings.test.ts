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

  // 並び順は人口で、順位に意味がない。ページ側はこのフラグで「N位」表示を止めるので
  // フラグと注記が外れないことを固定する。
  it("membershipList フラグと注記を持つ（順位として表示しないため）", () => {
    expect(def.membershipList).toBe(true);
    expect(def.note).toContain("順位表ではありません");
  });
});

describe("家賃ランキングの表記", () => {
  // 値は住宅・土地統計調査の階級中点による加重平均で、中央値ではない。
  // ラベルが「中央値」に戻らないことを固定する（honesty 方針）。
  it("家賃ランキングは中央値と表記しない", () => {
    for (const slug of ["rent-cheap", "rent-high"]) {
      const def = getRankingBySlug(slug)!;
      expect(def.columnLabel).toBe("家賃平均");
      expect(`${def.title}${def.lead}${def.description}${def.note ?? ""}`).not.toContain("家賃中央値");
      expect(def.note).toContain("加重平均");
    }
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

describe("population-decline ランキング", () => {
  const def = getRankingBySlug("population-decline")!;

  it("増減率の昇順（減少が大きい順）、率なし・人口0は除外", () => {
    const list = [
      muni({ code: "A", population: 10000, populationChangeRate: 2.5 }),
      muni({ code: "B", population: 10000, populationChangeRate: -3.1 }),
      muni({ code: "C", population: 10000, populationChangeRate: -7.2 }),
      muni({ code: "N", population: 10000 }), // 率なし（北方領土等）→除外
    ];
    expect(rankBy(def, list).map((m) => m.code)).toEqual(["C", "B", "A"]);
  });

  it("display は符号付き小数1桁の%（population-growth と同一整形）", () => {
    expect(def.display(muni({ populationChangeRate: -7.25 }))).toBe("-7.3%");
    expect(def.display(muni({ populationChangeRate: 3.14 }))).toBe("+3.1%");
  });
});

describe("population-most / population-density の metaDescription", () => {
  // 2026-08 GSC分析: 「{市} 人口」のような特定1市を探す検索でも表示されるため、
  // 都道府県別ページで全市区町村を掲載していることを明記する（rankings.ts 参照）。
  it("population-most は1位の人口数と国勢調査時点を含む", () => {
    const def = getRankingBySlug("population-most")!;
    const top1 = muni({ pref: "kanagawa", name: "横浜市", population: 3770000 });
    const desc = def.metaDescription!(top1);
    expect(desc).toContain("3,770,000人");
    expect(desc).toContain("国勢調査");
    expect(desc).toContain("県内の全市区町村");
  });

  it("population-density は1位の人口密度を含む", () => {
    const def = getRankingBySlug("population-density")!;
    const top1 = muni({ pref: "tokyo", name: "豊島区", population: 300000, areaKm2: 13 });
    const desc = def.metaDescription!(top1);
    expect(desc).toContain("人/km²");
    expect(desc).toContain("県内の全市区町村");
  });

  it("population-density-low も同様の実数値を含む", () => {
    const def = getRankingBySlug("population-density-low")!;
    const top1 = muni({ pref: "hokkaido", name: "音威子府村", population: 700, areaKm2: 276 });
    const desc = def.metaDescription!(top1);
    expect(desc).toContain("人/km²");
  });

  it("top1 が null でもフォールバック文言を返す", () => {
    const def = getRankingBySlug("population-most")!;
    expect(def.metaDescription!(null)).toContain("国勢調査");
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

describe("将来推計人口ランキング（IPSS 令和5年推計）", () => {
  const decline = getRankingBySlug("future-population-decline")!;
  const resilient = getRankingBySlug("future-population-resilient")!;

  const SOURCE = "国立社会保障・人口問題研究所 日本の地域別将来推計人口（令和5年推計）";
  const at = (code: string, base2020: number, t2050: number) =>
    muni({
      code,
      futurePopulation: {
        base2020,
        // ランキングが読むのは 2050 のみ（中間年は本テストでは不要）
        total: { "2050": t2050 },
        young2050: 0,
        working2050: 0,
        elderly2050: t2050,
        source: SOURCE,
        asOf: "2023",
      },
    });

  const list = [
    at("A", 100000, 50000), // -50%
    at("B", 100000, 105000), // +5%
    at("C", 100000, 80000), // -20%
    muni({ code: "X" }), // futurePopulation なし → 除外
    at("Y", 0, 0), // 対象外相当（base2020=0）→ 除外
  ];

  it("decline は減少率が大きい順、データなし・対象外は除外", () => {
    expect(rankBy(decline, list).map((m) => m.code)).toEqual(["A", "C", "B"]);
  });

  it("resilient は減少率が小さい順（増加が先頭）", () => {
    expect(rankBy(resilient, list).map((m) => m.code)).toEqual(["B", "C", "A"]);
  });

  it("display は符号付き小数1桁の%（2020年基準）", () => {
    expect(decline.display(at("A", 100000, 50000))).toBe("-50.0%");
    expect(decline.display(at("B", 100000, 105000))).toBe("+5.0%");
  });

  it("metaDescription は1位の増減率を含み、公的推計である旨を明示する", () => {
    const desc = decline.metaDescription!(at("A", 100000, 50000));
    expect(desc).toContain("-50.0%");
    expect(desc).toContain("令和5年推計");
    expect(decline.metaDescription!(null)).toContain("将来推計人口");
  });

  it("note に対象外の理由と「保証ではない」旨がある（煽り表現は使わない）", () => {
    for (const def of [decline, resilient]) {
      expect(def.note).toContain("保証するものではありません");
      expect(def.note).toContain("浜通り");
      expect(`${def.title}${def.lead}${def.note}`).not.toMatch(/消滅|消える/);
    }
  });
});
