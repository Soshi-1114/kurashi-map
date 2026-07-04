import { describe, it, expect } from "vitest";
import { buildRankPositions } from "@/lib/rankingStats";
import { RANKINGS } from "@/lib/rankings";
import { muni, metric } from "../_fixtures";

// 順位表の構築（詳細ページ「全国◯位」の単一ソース）。整列自体は rankings.test.ts が
// 担うので、ここでは「順位・母数・除外」の対応付けが正しいことを見る。
describe("buildRankPositions", () => {
  const cheap = muni({ code: "11201", name: "安い市", rent: metric({ value: 40000 }) });
  const mid = muni({ code: "11202", name: "中間市", rent: metric({ value: 60000 }) });
  const high = muni({ code: "11203", name: "高い市", rent: metric({ value: 90000 }) });
  // 家賃データなし（住宅統計の集計対象外）→ rent 系ランキングの母数に入らない
  const noRent = muni({ code: "11301", name: "小町村", rent: metric({ value: 0 }) });
  // 行政区は market-level ランキングから除外
  const ward = muni({
    code: "11107",
    name: "浦和区",
    level: "ward",
    parentCode: "11100",
    rent: metric({ value: 30000 }),
  });
  const all = [mid, cheap, high, noRent, ward];

  it("全ランキング定義ぶんの順位表を持つ", () => {
    const pos = buildRankPositions(all);
    for (const def of RANKINGS) expect(pos.has(def.slug)).toBe(true);
  });

  it("rent-cheap は安い順に 1..N、total は有効自治体数", () => {
    const byCode = buildRankPositions(all).get("rent-cheap")!;
    expect(byCode.get("11201")).toEqual({ rank: 1, total: 3 });
    expect(byCode.get("11202")).toEqual({ rank: 2, total: 3 });
    expect(byCode.get("11203")).toEqual({ rank: 3, total: 3 });
  });

  it("rent-high は rent-cheap と逆順", () => {
    const byCode = buildRankPositions(all).get("rent-high")!;
    expect(byCode.get("11203")!.rank).toBe(1);
    expect(byCode.get("11201")!.rank).toBe(3);
  });

  it("データなし自治体は順位を持たず、母数にも入らない", () => {
    const byCode = buildRankPositions(all).get("rent-cheap")!;
    expect(byCode.has("11301")).toBe(false);
    expect(byCode.get("11201")!.total).toBe(3); // noRent が母数に混ざっていない
  });

  it("行政区(level:ward)はどのランキングにも現れない（親市と重複させない）", () => {
    const pos = buildRankPositions(all);
    for (const def of RANKINGS) {
      expect(pos.get(def.slug)!.has("11107")).toBe(false);
    }
  });
});
