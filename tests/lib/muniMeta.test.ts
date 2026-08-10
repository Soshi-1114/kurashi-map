import { describe, it, expect } from "vitest";
import { buildMuniTitle, TITLE_BODY_BUDGET, type TitleMuni } from "@/lib/muniMeta";
import { buildAmbiguousNames } from "@/lib/muniLabel";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { prefNameOf, SITE } from "@/lib/site";
import { hasForeignData } from "@/lib/foreignResidents";

const metric = (value: number, source = "住宅・土地統計調査") => ({
  value,
  source,
  asOf: "2023",
});

function muni(over: Partial<TitleMuni> = {}): TitleMuni {
  return {
    name: "テスト市",
    population: 120000,
    rent: metric(62000),
    foreignResidents: metric(3600, "在留外国人統計"),
    ...over,
  } as TitleMuni;
}

const SUFFIX = ` - ${SITE.name}`;

describe("buildMuniTitle", () => {
  it("人口・家賃・在留外国人割合を実数値で並べる", () => {
    const title = buildMuniTitle(muni(), { prefName: "東京都", ambiguous: false });
    expect(title).toBe(`テスト市の人口12.0万人・家賃6.2万円｜外国人3.0%${SUFFIX}`);
  });

  it("同名自治体のときだけ県名を添える", () => {
    const m = muni({ name: "池田町", population: 22000, rent: metric(35000) });
    expect(buildMuniTitle(m, { prefName: "岐阜県", ambiguous: false })).toContain("池田町の人口");
    expect(buildMuniTitle(m, { prefName: "岐阜県", ambiguous: true })).toContain("池田町（岐阜県）の人口");
  });

  it("displayName があれば表示名として使う（政令市の行政区）", () => {
    const m = muni({ name: "北区", displayName: "大阪市北区", population: 150000 });
    expect(buildMuniTitle(m, { prefName: "大阪府", ambiguous: false })).toMatch(/^大阪市北区の/);
  });

  it("家賃が集計対象外なら家賃だけ落とす（推計で埋めない）", () => {
    const m = muni({ rent: metric(0, "住宅・土地統計調査（対象外）") });
    const title = buildMuniTitle(m, { prefName: "長野県", ambiguous: false });
    expect(title).toBe(`テスト市の人口12.0万人｜外国人3.0%${SUFFIX}`);
  });

  it("在留外国人統計の対象外なら割合を出さない", () => {
    const m = muni({ foreignResidents: metric(0, "在留外国人統計（対象外）") });
    const title = buildMuniTitle(m, { prefName: "北海道", ambiguous: false });
    expect(title).toBe(`テスト市の人口12.0万人・家賃6.2万円｜住環境データ${SUFFIX}`);
  });

  it("人口・家賃ともに無い場合（北方領土6村）は数値なしの文言になる", () => {
    const m = muni({
      population: 0,
      rent: metric(0, "住宅・土地統計調査（対象外）"),
      foreignResidents: metric(0, "在留外国人統計（対象外）"),
    });
    const title = buildMuniTitle(m, { prefName: "北海道", ambiguous: false });
    expect(title).toBe(`テスト市の住みやすさ・住環境データ${SUFFIX}`);
  });
});

describe("buildMuniTitle（実データ）", () => {
  it("全自治体の title 本文が文字数予算に収まる", async () => {
    const all = await listAllAcrossPrefs();
    const ambiguousNames = buildAmbiguousNames(all);
    const overBudget = all
      .map((m) => ({
        code: m.code,
        body: buildMuniTitle(m, {
          prefName: prefNameOf(m.pref),
          ambiguous: ambiguousNames.has(m.displayName ?? m.name),
        }).replace(SUFFIX, ""),
      }))
      .filter((t) => [...t.body].length > TITLE_BODY_BUDGET);
    expect(overBudget).toEqual([]);
  });

  it("数値なしのフォールバックに落ちるのは在留外国人統計・人口ともに対象外の自治体だけ", async () => {
    const all = await listAllAcrossPrefs();
    const fallback = all.filter((m) =>
      buildMuniTitle(m, { prefName: prefNameOf(m.pref), ambiguous: false }).includes("の住みやすさ・"),
    );
    // 北方領土6村のみ。全件が人口0かつ在留外国人統計の対象外であることまで確認する。
    expect(fallback).toHaveLength(6);
    for (const m of fallback) {
      expect(m.population).toBe(0);
      expect(hasForeignData(m.foreignResidents.source)).toBe(false);
    }
  });
});
