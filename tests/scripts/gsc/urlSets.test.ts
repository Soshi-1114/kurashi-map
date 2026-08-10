import { describe, it, expect } from "vitest";
import { compileUrlSet, globToRegExp, loadUrlSets } from "../../../scripts/gsc/urlSets";

describe("globToRegExp", () => {
  it("* は1セグメント（/ を跨がない）", () => {
    const re = globToRegExp("/area/*");
    expect(re.test("/area/tokyo")).toBe(true);
    expect(re.test("/area/tokyo/13121")).toBe(false);
    expect(re.test("/area")).toBe(false);
  });

  it("** は以降すべてに一致する", () => {
    const re = globToRegExp("/ranking/**");
    expect(re.test("/ranking/rent-cheap")).toBe(true);
    expect(re.test("/ranking/rent-cheap/saitama")).toBe(true);
  });

  it("完全一致（前後アンカー）で判定する", () => {
    const re = globToRegExp("/area/tokyo");
    expect(re.test("/area/tokyo")).toBe(true);
    expect(re.test("/x/area/tokyo")).toBe(false);
    expect(re.test("/area/tokyo/13121")).toBe(false);
  });

  it("正規表現メタ文字をエスケープする", () => {
    expect(globToRegExp("/a.b").test("/a.b")).toBe(true);
    expect(globToRegExp("/a.b").test("/axb")).toBe(false);
  });
});

describe("compileUrlSet", () => {
  it("include に一致し exclude に一致しないものだけ選ぶ", () => {
    const set = compileUrlSet({ name: "hub", include: ["/area/*"], exclude: ["/area/*/*"] });
    expect(set.matches("/area/tokyo")).toBe(true);
    expect(set.matches("/area/tokyo/13121")).toBe(false);
    expect(set.matches("/ranking/rent-cheap")).toBe(false);
  });

  it("include が複数ならいずれかに一致すればよい", () => {
    const set = compileUrlSet({ name: "pop", include: ["/ranking/population-most", "/ranking/population-most/*"] });
    expect(set.matches("/ranking/population-most")).toBe(true);
    expect(set.matches("/ranking/population-most/aichi")).toBe(true);
    expect(set.matches("/ranking/rent-cheap")).toBe(false);
  });
});

describe("loadUrlSets（実ファイル）", () => {
  it("docs/seo/url-sets.json を読み、実施済みPRのセットを含む", () => {
    const sets = loadUrlSets();
    expect(sets.length).toBeGreaterThan(0);
    const byName = new Map(sets.map((s) => [s.name, s]));

    // 県ハブのセットは自治体詳細を含めない
    const hub = byName.get("pr-127-130-pref-hub");
    expect(hub?.matches("/area/tokyo")).toBe(true);
    expect(hub?.matches("/area/tokyo/13121")).toBe(false);

    // 自治体詳細のセットは県ハブを含めない
    const muni = byName.get("pr-129-muni-title");
    expect(muni?.matches("/area/tokyo/13121")).toBe(true);
    expect(muni?.matches("/area/tokyo")).toBe(false);

    // 県別ランキングのセットは全国版ランキングを含めない
    const prefRanking = byName.get("pr-126-pref-ranking-descriptions");
    expect(prefRanking?.matches("/ranking/rent-cheap/saitama")).toBe(true);
    expect(prefRanking?.matches("/ranking/rent-cheap")).toBe(false);
  });

  it("全セットが name と1件以上の include を持つ", () => {
    for (const s of loadUrlSets()) {
      expect(s.name).toBeTruthy();
      expect(s.include.length).toBeGreaterThan(0);
    }
  });

  it("同一URL群を指すセットが重複していない（効果を分離できないため）", () => {
    const keys = loadUrlSets().map((s) => JSON.stringify([[...s.include].sort(), [...(s.exclude ?? [])].sort()]));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
