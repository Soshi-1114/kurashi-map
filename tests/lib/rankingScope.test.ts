import { describe, expect, it } from "vitest";
import { parseRankingScope, rankingFeedbackPage, rankingScopeHref, scopedRankingRows, type RankingRow } from "@/lib/rankingScope";

describe("地域内ランキング", () => {
  it("全国上位100件の外側も含め、地域の全対象から順位を求める", () => {
    const rows: RankingRow[] = Array.from({ length: 100 }, (_, i) => ({ code: `27${String(i).padStart(3, "0")}`, pref: "osaka", name: `大阪${i}`, value: "100" }));
    rows.push({ code: "13201", pref: "tokyo", name: "八王子市", value: "50" }, { code: "08220", pref: "ibaraki", name: "つくば市", value: "40" });
    expect(scopedRankingRows(rows, "region:kanto").map(m => m.name)).toEqual(["八王子市", "つくば市"]);
    expect(scopedRankingRows(rows, "pref:ibaraki")).toHaveLength(1);
  });
  it("不正な地方・県は既定範囲へ戻し、地方と県の同名を区別する", () => {
    expect(parseRankingScope("region:not-real")).toBe("all");
    expect(parseRankingScope(null, "not-real")).toBe("all");
    expect(parseRankingScope("region:not-real", "tokyo")).toBe("pref:tokyo");
    expect(rankingScopeHref("stations", "region:hokkaido")).toBe("/ranking/stations?region=hokkaido");
    expect(rankingScopeHref("stations", "pref:hokkaido")).toBe("/ranking/stations/hokkaido");
  });
  it("指標を変えても地方範囲を共有でき、アンケートは範囲ごとに分ける", () => {
    expect(rankingScopeHref("preschools", "region:kanto")).toBe("/ranking/preschools?region=kanto");
    expect(rankingFeedbackPage("stations", "region:kanto")).toBe("ranking:stations:region:kanto");
    expect(rankingFeedbackPage("stations", "all")).toBe("ranking:stations");
  });
});
