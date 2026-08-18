import { describe, expect, it } from "vitest";
import { PREF_BBOXES } from "@/components/map/prefBboxes";
import { PREFS } from "@/lib/prefs";
import { PREFS as SCRIPT_PREFS } from "@/scripts/_lib/prefs.mjs";

// prefBboxes.ts は scripts/build-pref-bboxes.mjs による生成物。
// ソース（scripts/_lib/prefs.mjs の bbox）とのドリフトと、値の妥当性を機械的に守る。
describe("PREF_BBOXES（地図ディープリンク用の県別 bbox）", () => {
  it("47都道府県すべてを過不足なく持つ（lib/prefs.ts と一致）", () => {
    const slugs = PREFS.map((p) => p.slug).sort();
    expect(Object.keys(PREF_BBOXES).sort()).toEqual(slugs);
  });

  it("ソースの scripts/_lib/prefs.mjs とドリフトしていない（再生成漏れ検出）", () => {
    for (const [slug, p] of Object.entries(SCRIPT_PREFS) as [
      string,
      { bbox: { west: number; south: number; east: number; north: number } },
    ][]) {
      expect(PREF_BBOXES[slug], slug).toEqual([p.bbox.west, p.bbox.south, p.bbox.east, p.bbox.north]);
    }
  });

  it("各 bbox は west<east・south<north で日本の範囲に収まる", () => {
    for (const [slug, [w, s, e, n]] of Object.entries(PREF_BBOXES)) {
      expect(w, slug).toBeLessThan(e);
      expect(s, slug).toBeLessThan(n);
      expect(w, slug).toBeGreaterThan(122);
      expect(e, slug).toBeLessThan(154);
      expect(s, slug).toBeGreaterThan(20);
      expect(n, slug).toBeLessThan(46);
    }
  });

  it("島嶼を含まない本土中心の bbox である（東京=伊豆・小笠原、鹿児島=奄美を除く）", () => {
    expect(PREF_BBOXES.tokyo[1]).toBeGreaterThan(34); // 小笠原(緯度~24-27)・伊豆諸島を含まない
    expect(PREF_BBOXES.kagoshima[1]).toBeGreaterThanOrEqual(30); // 奄美(~27-28.5)を含まない
    expect(PREF_BBOXES.okinawa[0]).toBeGreaterThan(126); // 宮古・八重山(~122.9-125.5)を含まない
  });
});
