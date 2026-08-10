import { describe, it, expect } from "vitest";
import { buildAmbiguousNames } from "@/lib/muniLabel";
import { listAllAcrossPrefs } from "@/lib/metrics";

describe("buildAmbiguousNames", () => {
  it("複数の都道府県にある同名を抽出する", () => {
    const all = [
      { pref: "hokkaido", name: "池田町" },
      { pref: "gifu", name: "池田町" },
      { pref: "saitama", name: "川口市" },
    ];
    const ambiguous = buildAmbiguousNames(all);
    expect(ambiguous.has("池田町")).toBe(true);
    expect(ambiguous.has("川口市")).toBe(false);
  });

  it("同一県内の同名は曖昧としない（県名を添えても区別できないため）", () => {
    // 北海道の泊村（積丹郡・北方領土）が唯一の実例。
    const all = [
      { pref: "hokkaido", name: "泊村" },
      { pref: "hokkaido", name: "泊村" },
    ];
    expect(buildAmbiguousNames(all).size).toBe(0);
  });

  it("displayName があればそれを名前として使う（政令市の区は衝突しない）", () => {
    const all = [
      { pref: "osaka", name: "北区", displayName: "大阪市北区" },
      { pref: "hyogo", name: "北区", displayName: "神戸市北区" },
    ];
    // displayName がフル名称なので「北区」同士でも曖昧にならない
    expect(buildAmbiguousNames(all).size).toBe(0);
  });
});

describe("buildAmbiguousNames（実データ）", () => {
  it("既知の同名自治体を検出し、政令市の区は含めない", async () => {
    const ambiguous = buildAmbiguousNames(await listAllAcrossPrefs());
    // 池田町は北海道・福井・長野・岐阜に存在する
    expect(ambiguous.has("池田町")).toBe(true);
    // 府中市は東京・広島に存在する
    expect(ambiguous.has("府中市")).toBe(true);
    // displayName がフル名称の行政区は衝突しない
    expect(ambiguous.has("大阪市北区")).toBe(false);
    // 全国で一意な自治体は含まない
    expect(ambiguous.has("川口市")).toBe(false);
  });
});
