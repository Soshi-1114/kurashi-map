import { describe, expect, it } from "vitest";
import { populationSearchCopy } from "@/lib/populationSearchCopy";
import { RANKINGS } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import type { Municipality } from "@/lib/types";
import mie from "@/data/mie.json";

const top = { ...mie[0], population: 123456 } as Municipality;
describe("人口検索語に合わせた2URL限定の文言", () => {
  it("全国の集計総数と掲載上位100件を区別する", () => {
    const copy = populationSearchCopy({ metric: "population-most", top, count: 1741, shown: 100 })!;
    expect(copy.title).toBe("全国の市区町村人口ランキング（人口が多い順）");
    expect(copy.description).toContain("全国1,741市区町村を集計し、上位100位を掲載");
    expect(copy.description).toContain("三重県津市（123,456人）");
    expect(copy.lead).toContain("行政区を重複計上しません");
  });
  it("三重県は県内の市町全件掲載と基本集計を明示する", () => {
    const copy = populationSearchCopy({ metric: "population-most", pref: "mie", top, count: 29, shown: 29 })!;
    expect(copy.title).toBe("三重県の市区町村人口ランキング（人口が多い順）");
    expect(copy.description).toContain("三重県内の29市町を掲載");
    expect(copy.description).toContain("人口等基本集計");
    expect(copy.description).not.toContain("上位100");
  });
  it("他県・他指標の全組合せへ文言を適用しない", () => {
    for (const metric of RANKINGS) {
      for (const pref of [undefined, ...PREFS.map((p) => p.slug)]) {
        if (metric.slug === "population-most" && (pref === undefined || pref === "mie")) continue;
        expect(populationSearchCopy({ metric: metric.slug, pref, top, count: 29, shown: 29 })).toBeNull();
      }
    }
  });
  it("集計対象がない場合に1位を作らない", () => {
    expect(populationSearchCopy({ metric: "population-most", count: 0, shown: 0 })).toBeNull();
  });
});
