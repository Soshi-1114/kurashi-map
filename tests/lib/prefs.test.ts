import { describe, it, expect } from "vitest";
import { getPrefBySlug, getPrefByCode, listPrefSlugs, PREFS } from "@/lib/prefs";
import { PREFS as SCRIPT_PREFS, JP_BOUNDS } from "@/scripts/_lib/prefs.mjs";

describe("PREFS マニフェスト", () => {
  it("47 都道府県", () => {
    expect(PREFS.length).toBe(47);
    expect(listPrefSlugs().length).toBe(47);
  });
  it("slug / codePrefix は一意", () => {
    expect(new Set(PREFS.map((p) => p.slug)).size).toBe(47);
    expect(new Set(PREFS.map((p) => p.codePrefix)).size).toBe(47);
  });

  // CLAUDE.md の規約「lib/prefs.ts と scripts/_lib/prefs.mjs は同期を保つ」を機械検証。
  it("scripts/_lib/prefs.mjs とドリフトしていない（共通フィールド全比較）", () => {
    expect(Object.keys(SCRIPT_PREFS).sort()).toEqual(PREFS.map((p) => p.slug).sort());
    for (const p of PREFS) {
      const s = SCRIPT_PREFS[p.slug as keyof typeof SCRIPT_PREFS] as {
        code: string; nameJa: string; hasWards: boolean;
        bbox: { west: number; south: number; east: number; north: number };
      };
      expect(p.codePrefix, p.slug).toBe(s.code);
      expect(p.nameJa, p.slug).toBe(s.nameJa);
      expect(p.hasWards, p.slug).toBe(s.hasWards);
      expect(p.bbox, p.slug).toEqual([s.bbox.west, s.bbox.south, s.bbox.east, s.bbox.north]);
    }
  });

  it("bbox は w<e・s<n で日本の範囲に収まる", () => {
    for (const { slug, bbox: [w, s, e, n] } of PREFS) {
      expect(w, slug).toBeLessThan(e);
      expect(s, slug).toBeLessThan(n);
      expect(w, slug).toBeGreaterThan(JP_BOUNDS.west);
      expect(e, slug).toBeLessThan(JP_BOUNDS.east);
      expect(s, slug).toBeGreaterThan(JP_BOUNDS.south);
      expect(n, slug).toBeLessThan(JP_BOUNDS.north);
    }
  });

  it("bbox は島嶼を除いた本土中心（地図初期フォーカスが離島まで引かない退行防止）", () => {
    expect(getPrefBySlug("tokyo")!.bbox[1]).toBeGreaterThan(34); // 伊豆諸島・小笠原(緯度~24-33)を含まない
    expect(getPrefBySlug("kagoshima")!.bbox[1]).toBeGreaterThanOrEqual(30); // 奄美(~27-28.5)を含まない
    expect(getPrefBySlug("okinawa")!.bbox[0]).toBeGreaterThan(126); // 宮古・八重山(~122.9-125.5)を含まない
  });
});

describe("getPrefBySlug", () => {
  it("既知 slug", () => {
    expect(getPrefBySlug("saitama")?.codePrefix).toBe("11");
  });
  it("未知 slug は null", () => {
    expect(getPrefBySlug("atlantis")).toBeNull();
  });
});

describe("getPrefByCode", () => {
  it("5桁コードの先頭2桁で引く", () => {
    expect(getPrefByCode("11203")?.slug).toBe("saitama");
    expect(getPrefByCode("01100")?.slug).toBe("hokkaido");
    expect(getPrefByCode("13104")?.slug).toBe("tokyo");
  });
  it("未知コードは null", () => {
    expect(getPrefByCode("99999")).toBeNull();
  });
});
