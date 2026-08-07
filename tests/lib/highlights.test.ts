import { describe, it, expect } from "vitest";
import { buildHighlights, type HighlightsCtx } from "@/lib/highlights";
import type { MetricAvg } from "@/lib/areaStats";
import type { RankPos } from "@/lib/rankingStats";
import type { PrefRankPos } from "@/lib/prefRanks";
import { muni, metric } from "../_fixtures";

// 「この自治体の特徴」抽出。honesty 方針の要:
// - 欠損（センチネル）指標は候補に入れない
// - 平均に近い指標で「同水準」等のノイズ文を作らない
// - 文面は客観表現のみ（評価語なし）
// - 決定論（同じ入力なら常に同じ出力）

function avg(national: number | null, byPref: Record<string, number> = {}): MetricAvg {
  return { national, byPref: new Map(Object.entries(byPref)) };
}

function rankMap(entries: Record<string, Record<string, RankPos>>): Map<string, Map<string, RankPos>> {
  return new Map(Object.entries(entries).map(([slug, byCode]) => [slug, new Map(Object.entries(byCode))]));
}

function prefRankMap(entries: Record<string, Record<string, PrefRankPos>>) {
  return new Map(Object.entries(entries).map(([k, byCode]) => [k, new Map(Object.entries(byCode))])) as HighlightsCtx["prefRanks"];
}

function ctx(partial: Partial<HighlightsCtx> = {}): HighlightsCtx {
  return {
    areaStats: {
      rent: avg(60000, { saitama: 62000 }),
      landPrice: avg(100000),
      populationChangeRate: avg(-2.0),
      vacancyRate: avg(13.0),
      density: avg(1000),
    },
    foreign: null,
    rankPositions: new Map(),
    prefRanks: new Map(),
    prefName: "埼玉県",
    ...partial,
  };
}

describe("buildHighlights", () => {
  it("極端に安い家賃は採用され、方向語と全国順位（安い順）が付く。5件で頭打ち", () => {
    const m = muni({
      rent: metric({ value: 30000 }), // 全国平均60000より50%低い
      landPrice: metric({ value: 300000, unit: "円/㎡" }), // 3倍 → capped
      populationChangeRate: 8, // 平均-2より10pt高い
      vacancy: { rate: 25, vacant: 100, total: 400, source: "住宅・土地統計調査", asOf: "2023" },
      waitlistChildren: metric({ value: 0, unit: "人", asOf: "2025-04-01" }),
    });
    const c = ctx({
      foreign: {
        ratio: 6, nationalAvg: 3, prefAvg: 3, nationalRank: 5, nationalTotal: 1741,
        prefRank: 1, prefTotal: 63, asOf: "2025-12",
      },
      rankPositions: rankMap({
        "rent-cheap": { [m.code]: { rank: 10, total: 1200 } },
      }),
    });
    const hl = buildHighlights(m, c);
    expect(hl).toHaveLength(5); // 6候補（rent/land/change/vacancy/foreign/waitlistZero）→ 上位5件
    const rent = hl.find((h) => h.key === "rent")!;
    expect(rent.text).toContain("全国平均（60,000円）より50%低い水準");
    expect(rent.text).toContain("安い順で全国10位／1,200自治体中");
    // スコア降順: land(1.5cap) → change(1.5cap) → vacancy(1.2) → foreign(1.0) → rent(0.5)
    expect(hl.map((h) => h.key)).toEqual(["landPrice", "populationChangeRate", "vacancy", "foreignRatio", "rent"]);
    // waitlistZero(0.5) は rent(0.5) と同点だが優先順で rent が勝ち、6件目として落ちる
    expect(hl.find((h) => h.key === "waitlistZero")).toBeUndefined();
    // 評価語を含まない
    for (const h of hl) {
      expect(h.text).not.toMatch(/住みやすい|おすすめ|便利|安全/);
    }
  });

  it("極端に高い家賃は「高い」方向語と rent-high 側の順位表を使う", () => {
    const m = muni({ rent: metric({ value: 120000 }) });
    const c = ctx({
      rankPositions: rankMap({
        "rent-cheap": { [m.code]: { rank: 1190, total: 1200 } },
        "rent-high": { [m.code]: { rank: 11, total: 1200 } },
      }),
    });
    const rent = buildHighlights(m, c).find((h) => h.key === "rent")!;
    expect(rent.text).toContain("より100%高い水準");
    expect(rent.text).toContain("高い順で全国11位");
  });

  it("欠損センチネル（rent=0・vacancy.rate=-1・landPrice=0・foreign対象外）は候補に入れず、落ちない", () => {
    const m = muni({
      rent: metric({ value: 0, source: "データなし（住宅統計の集計対象外）", asOf: "-" }),
      landPrice: metric({ value: 0, unit: "円/㎡", source: "対象外（地価公示・地価調査の標準地なし）", asOf: "-" }),
      vacancy: { rate: -1, vacant: 0, total: 0, source: "データなし（住宅統計の集計対象外）", asOf: "-" },
      waitlistChildren: metric({ value: 3, unit: "人" }), // ゼロでない → membership も出ない
    });
    const hl = buildHighlights(m, ctx());
    expect(hl.map((h) => h.key)).not.toContain("rent");
    expect(hl.map((h) => h.key)).not.toContain("landPrice");
    expect(hl.map((h) => h.key)).not.toContain("vacancy");
    expect(hl.map((h) => h.key)).not.toContain("foreignRatio");
    for (const h of hl) {
      expect(h.text).not.toMatch(/NaN|undefined|null/);
    }
  });

  it("全指標が平均と同値なら偏差項目ゼロ。順位事実でバックフィルし「同水準」文は作らない", () => {
    const m = muni({
      rent: metric({ value: 60000 }),
      landPrice: metric({ value: 100000, unit: "円/㎡" }),
      populationChangeRate: -2.0,
      vacancy: { rate: 13.0, vacant: 50, total: 385, source: "住宅・土地統計調査", asOf: "2023" },
      waitlistChildren: metric({ value: 0, unit: "人", asOf: "2025-04-01" }),
    });
    const c = ctx({
      rankPositions: rankMap({
        "population-most": { [m.code]: { rank: 500, total: 1741 } },
      }),
      prefRanks: prefRankMap({
        population: { [m.code]: { rank: 12, total: 63 } },
      }),
    });
    const hl = buildHighlights(m, c);
    expect(hl).toHaveLength(3); // waitlistZero + 人口バックフィル + 家賃県平均バックフィル
    expect(hl[0].key).toBe("waitlistZero");
    const pop = hl.find((h) => h.key === "population")!;
    expect(pop.text).toContain("全国500位");
    expect(pop.text).toContain("埼玉県内12位");
    const rentPref = hl.find((h) => h.key === "rentPref")!;
    expect(rentPref.text).toContain("埼玉県平均は62,000円");
    for (const h of hl) {
      expect(h.text).not.toContain("同水準");
    }
  });

  it("行政区（順位表に code なし）は順位句なしの偏差文になる", () => {
    const m = muni({
      code: "11107",
      level: "ward",
      parentCode: "11100",
      rent: metric({ value: 90000 }), // +50%
    });
    const hl = buildHighlights(m, ctx());
    const rent = hl.find((h) => h.key === "rent")!;
    expect(rent.text).toContain("より50%高い水準");
    expect(rent.text).not.toMatch(/全国[\d,]+位/);
  });

  it("バックフィル可能な事実が無い自治体（北方領土相当）は空配列を返す", () => {
    const m = muni({
      population: 0,
      rent: metric({ value: 0, source: "データなし（住宅統計の集計対象外）", asOf: "-" }),
      landPrice: metric({ value: 0, unit: "円/㎡", source: "対象外（北方領土・地価公示等の標準地なし）", asOf: "-" }),
      waitlistChildren: metric({ value: 0, unit: "人" }),
      vacancy: { rate: -1, vacant: 0, total: 0, source: "データなし（住宅統計の集計対象外）", asOf: "-" },
    });
    // population 0 → 待機児童ゼロ membership は残る（公表値）が、他は何も出ない
    const hl = buildHighlights(m, ctx());
    expect(hl.map((h) => h.key)).toEqual(["waitlistZero"]);
  });

  it("しきい値ちょうどは採用、僅かに下回ると不採用（家賃15%境界）", () => {
    const included = buildHighlights(muni({ rent: metric({ value: 69000 }) }), ctx()); // +15.0%
    expect(included.map((h) => h.key)).toContain("rent");
    const excluded = buildHighlights(muni({ rent: metric({ value: 68900 }) }), ctx()); // +14.8%
    expect(excluded.map((h) => h.key)).not.toContain("rent");
  });

  it("決定論: 同じ入力で2回呼んでも同じ結果", () => {
    const m = muni({ rent: metric({ value: 30000 }), populationChangeRate: 5 });
    const a = buildHighlights(m, ctx());
    const b = buildHighlights(m, ctx());
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
