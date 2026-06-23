import { describe, it, expect } from "vitest";
import {
  hasForeignData,
  foreignRatioPct,
  hasForeignRatio,
  isNationalityDisclosed,
  FOREIGN_NODATA_RATIO,
} from "@/lib/foreignResidents";
import { metric, muni } from "../_fixtures";

describe("hasForeignData", () => {
  it("通常の出典は対象", () => {
    expect(hasForeignData("出入国在留管理庁 在留外国人統計")).toBe(true);
  });
  it("「対象外」を含む出典は非対象（北方領土など）", () => {
    expect(hasForeignData("対象外（北方領土）")).toBe(false);
  });
});

describe("foreignRatioPct", () => {
  it("総数÷人口×100 を返す", () => {
    const m = muni({
      population: 100000,
      foreignResidents: metric({ value: 2500, source: "出入国在留管理庁 在留外国人統計" }),
    });
    expect(foreignRatioPct(m)).toBeCloseTo(2.5, 5);
  });
  it("0人は 0%（実データ。データなしではない）", () => {
    const m = muni({
      population: 1121,
      foreignResidents: metric({ value: 0, source: "出入国在留管理庁 在留外国人統計" }),
    });
    expect(foreignRatioPct(m)).toBe(0);
  });
  it("対象外（北方領土）はデータなしセンチネル", () => {
    const m = muni({
      population: 0,
      foreignResidents: metric({ value: 0, source: "対象外（北方領土）" }),
    });
    expect(foreignRatioPct(m)).toBe(FOREIGN_NODATA_RATIO);
  });
  it("人口0（不明）はデータなしセンチネル", () => {
    const m = muni({
      population: 0,
      foreignResidents: metric({ value: 5, source: "出入国在留管理庁 在留外国人統計" }),
    });
    expect(foreignRatioPct(m)).toBe(FOREIGN_NODATA_RATIO);
  });
});

describe("hasForeignRatio", () => {
  it("0以上は有効、負値はデータなし", () => {
    expect(hasForeignRatio(0)).toBe(true);
    expect(hasForeignRatio(3.4)).toBe(true);
    expect(hasForeignRatio(FOREIGN_NODATA_RATIO)).toBe(false);
    expect(hasForeignRatio(-1)).toBe(false);
  });
});

describe("isNationalityDisclosed", () => {
  it("総数10人以下は国籍非開示（注2の秘匿）", () => {
    expect(isNationalityDisclosed(10)).toBe(false);
    expect(isNationalityDisclosed(0)).toBe(false);
    expect(isNationalityDisclosed(11)).toBe(true);
    expect(isNationalityDisclosed(5000)).toBe(true);
  });
});
