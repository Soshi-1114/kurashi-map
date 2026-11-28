import { describe, expect, it } from "vitest";
import { populationSearchCopy } from "@/lib/populationSearchCopy";
import { RANKINGS } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import type { Municipality } from "@/lib/types";
import mie from "@/data/mie.json";

const top = { ...mie[0], population: 123456 } as Municipality;
describe("人口検索語に合わせた全国・対象県限定の文言", () => {
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
        if (metric.slug === "population-most" && (pref === undefined || ["mie", "yamaguchi", "shimane", "hyogo"].includes(pref))) continue;
        expect(populationSearchCopy({ metric: metric.slug, pref, top, count: 29, shown: 29 })).toBeNull();
      }
    }
  });
  it.each([ ["yamaguchi", "山口県", 19, "市町"], ["shimane", "島根県", 19, "市町村"] ] as const)("%sは検索意図と全件掲載範囲を明示する", (pref, name, count, unit) => {
    const copy = populationSearchCopy({ metric: "population-most", pref, top, count, shown: count })!;
    expect(copy.title).toBe(`${name}の人口ランキング（${unit}別・多い順）`);
    expect(copy.description).toContain(`${name}内の${count}${unit}を掲載`);
    expect(copy.description).toContain("123,456人");
    expect(copy.lead).toContain("行政区を重複計上しません");
  });
  it("集計対象がない場合に1位を作らない", () => {
    expect(populationSearchCopy({ metric: "population-most", count: 0, shown: 0 })).toBeNull();
  });
  it("兵庫だけに簡潔なmeta title・表直前の答え・同じ系列の基準と出典を返す", () => {
    const copy = populationSearchCopy({ metric: "population-most", pref: "hyogo", top, count: 41, shown: 41 })!;
    expect(copy.title).toBe("兵庫県の人口ランキング（市町別・多い順）");
    expect(copy.metaTitle).toBe("兵庫県の人口ランキング【2025年国勢調査】全41市町");
    expect(copy.answer).toBe("1位 津市 123,456人／全41市町");
    expect(copy.basis).toContain("2025年10月1日現在");
    expect(copy.basis).toContain("人口等基本集計（総人口・男女総数）");
    expect(copy.basis).toContain("行政区を重複計上しません");
    expect(copy.description).toContain(copy.basis);
    expect(copy.sourceUrl).toBe("https://www.stat.go.jp/data/kokusei/2025/kekka.html");
    const changed = populationSearchCopy({ metric: "population-most", pref: "hyogo", top: { ...top, population: 765432, name: "別の市", displayName: undefined }, count: 40, shown: 40 })!;
    expect(changed.answer).toBe("1位 別の市 765,432人／全40市町");
    expect(changed.metaTitle).toContain("全40市町");
  });
  it("既存の全国・三重・山口・島根に兵庫の専用項目を追加しない", () => {
    for (const pref of [undefined, "mie", "yamaguchi", "shimane"]) {
      const copy = populationSearchCopy({ metric: "population-most", pref, top, count: 29, shown: 29 })!;
      expect(copy.metaTitle).toBeUndefined(); expect(copy.answer).toBeUndefined(); expect(copy.basis).toBeUndefined();
    }
  });
});
