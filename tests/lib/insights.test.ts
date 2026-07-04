import { describe, it, expect } from "vitest";
import { buildInsights, type InsightContext } from "@/lib/insights";
import type { AreaStats } from "@/lib/areaStats";
import type { RankPos } from "@/lib/rankingStats";
import type { ForeignComparison } from "@/lib/foreignStats";
import { muni, metric } from "../_fixtures";

// テスト用の InsightContext を組み立てる小道具。
function ctx(partial: Partial<InsightContext> = {}): InsightContext {
  const areaStats: AreaStats = {
    rent: { national: 55000, byPref: new Map([["saitama", 60000]]) },
    landPrice: { national: 100000, byPref: new Map([["saitama", 150000]]) },
  };
  const rankPositions = new Map<string, Map<string, RankPos>>([
    ["rent-cheap", new Map([["11203", { rank: 120, total: 1700 }]])],
    ["land-price-high", new Map([["11203", { rank: 30, total: 800 }]])],
    ["population-most", new Map([["11203", { rank: 45, total: 1741 }]])],
  ]);
  return { prefName: "埼玉県", areaStats, rankPositions, fc: null, ...partial };
}

const FC: ForeignComparison = {
  ratio: 6.3, nationalAvg: 2.5, prefAvg: 4.0,
  nationalRank: 88, nationalTotal: 1700, prefRank: 5, prefTotal: 60, asOf: "2024-12",
};

// 家賃の解説文（統合されない場合、"円/月" を含むのは家賃文だけ）を取り出す。
const rentLine = (m: Parameters<typeof buildInsights>[0], c: InsightContext) =>
  buildInsights(m, c).find((s) => s.includes("円/月"));

describe("buildInsights（文型バンク＋決定的セレクタ）", () => {
  it("家賃は値・段階的な比較句・分位/順位のいずれかを含む", () => {
    // 家賃54000（県平均60000を10%下回る）／地価はデフォ200000で県平均150000を上回る
    // ＝方向が逆なので統合されず、家賃は単独文になる。
    const line = rentLine(muni({ rent: metric({ value: 54000 }) }), ctx());
    expect(line).toBeDefined();
    expect(line).toContain("54,000円/月");
    expect(line).toContain("下回る水準"); // {cmp} は連体形+水準に統一
  });

  it("乖離20%以上は『大きく』を付す", () => {
    const line = rentLine(muni({ rent: metric({ value: 45000 }) }), ctx()); // -25%
    expect(line).toContain("大きく下回る水準");
  });

  it("平均との差が3%未満は『ほぼ同水準』（方向語を出さない）", () => {
    const line = rentLine(muni({ rent: metric({ value: 61000 }) }), ctx()); // +1.7%
    expect(line).toContain("ほぼ同水準");
    expect(line).not.toContain("下回る");
    expect(line).not.toContain("上回る");
  });

  it("家賃・地価がともに県平均から同方向なら住居コストに統合する", () => {
    // 家賃55000（-8%）・地価130000（-13%）＝ともに下回る。
    const m = muni({ rent: metric({ value: 55000 }), landPrice: metric({ value: 130000, unit: "円/㎡" }) });
    const lines = buildInsights(m, ctx());
    const combined = lines.find((s) => s.includes("55,000円/月") && s.includes("130,000円/㎡"));
    expect(combined).toBeDefined();
    expect(combined).toContain("抑えめ");
    // 統合時は順位補足の1文が続く
    expect(lines.some((s) => s.includes("家賃の安さは全国") && s.includes("地価の高さは全国"))).toBe(true);
  });

  it("外国人比率は比率・全国平均との対比を含む（fc があるときのみ）", () => {
    const withFc = buildInsights(muni(), ctx({ fc: FC })).find((s) => s.includes("外国人住民比率"));
    expect(withFc).toContain("6.30%");
    expect(withFc).toContain("高め"); // 6.30 > 全国平均2.50
    expect(withFc).toContain("多様性・国際性の目安になります。");
    // fc が null なら外国人比率の文は出ない
    expect(buildInsights(muni(), ctx()).some((s) => s.includes("外国人住民比率"))).toBe(false);
  });

  it("待機児童ゼロは 0人 を明示する", () => {
    const lines = buildInsights(muni({ waitlistChildren: metric({ value: 0, unit: "人" }) }), ctx());
    expect(lines.some((s) => s.includes("待機児童") && s.includes("0人"))).toBe(true);
  });

  it("同じ自治体コードでは毎回同じ文型を選ぶ（決定的）", () => {
    const m = muni({ rent: metric({ value: 54000 }) });
    expect(rentLine(m, ctx())).toBe(rentLine(m, ctx()));
  });

  it("欠損（家賃・地価なし、順位・fc なし）は該当文を出さない", () => {
    const m = muni({
      rent: metric({ value: 0 }),
      landPrice: metric({ value: 0, unit: "円/㎡" }),
      waitlistChildren: metric({ value: 0, unit: "人", source: "区別非公表（さいたま市）" }),
    });
    const emptyCtx: InsightContext = {
      prefName: "埼玉県",
      areaStats: { rent: { national: null, byPref: new Map() }, landPrice: { national: null, byPref: new Map() } },
      rankPositions: new Map(),
      fc: null,
    };
    const out = buildInsights(m, emptyCtx);
    expect(out.some((s) => s.includes("家賃中央値"))).toBe(false);
    expect(out.some((s) => s.includes("公示地価"))).toBe(false);
    expect(out.some((s) => s.includes("外国人住民比率"))).toBe(false);
  });
});
