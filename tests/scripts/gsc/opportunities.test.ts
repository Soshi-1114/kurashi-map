import { describe, it, expect } from "vitest";
import {
  comparePages,
  findHighImpressionLowCtr,
  findNearTop,
  findNewVisibility,
  findPage2,
  findPositionDecline,
  findPositionImprove,
  findZeroClickHighImpression,
  topLosers,
  topWinners,
} from "../../../scripts/gsc/opportunities";
import type { Metrics, UrlMeta } from "../../../scripts/gsc/types";

function metrics(clicks: number, impressions: number, position: number): Metrics {
  return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position };
}

const classifyUrl = (url: string): UrlMeta => ({ url, path: url, pageType: "municipality", muniName: url });

describe("Opportunity A: highImpressionLowCtr", () => {
  it("impressions>=100 かつ position<=10 かつ ctr<3% を抽出する", () => {
    const pages = new Map([
      ["/a", metrics(2, 200, 5)], // ctr=1% -> 該当
      ["/b", metrics(20, 200, 5)], // ctr=10% -> 非該当
      ["/c", metrics(1, 50, 5)], // impressions不足 -> 非該当
    ]);
    const out = findHighImpressionLowCtr(pages, classifyUrl);
    expect(out.map((r) => r.url)).toEqual(["/a"]);
  });
});

describe("Opportunity B: page2（11〜15位を優先）", () => {
  it("8〜20位・impressions>=50 を抽出し、11〜15位を先に並べる", () => {
    const pages = new Map([
      ["/pos9", metrics(1, 100, 9)],
      ["/pos13", metrics(1, 60, 13)],
      ["/pos25", metrics(1, 100, 25)], // 範囲外
    ]);
    const out = findPage2(pages, classifyUrl);
    expect(out.map((r) => r.url)).toEqual(["/pos13", "/pos9"]);
  });
});

describe("Opportunity C: nearTop", () => {
  it("4〜10位・impressions>=50 を順位昇順で抽出する", () => {
    const pages = new Map([
      ["/pos7", metrics(1, 60, 7)],
      ["/pos4", metrics(1, 60, 4)],
      ["/pos11", metrics(1, 60, 11)], // 範囲外
    ]);
    const out = findNearTop(pages, classifyUrl);
    expect(out.map((r) => r.url)).toEqual(["/pos4", "/pos7"]);
  });
});

describe("Opportunity D: zeroClickHighImpression", () => {
  it("clicks=0 かつ impressions>=50 を抽出する", () => {
    const pages = new Map([
      ["/zero", metrics(0, 80, 15)],
      ["/notzero", metrics(1, 80, 15)],
      ["/lowimp", metrics(0, 10, 15)],
    ]);
    const out = findZeroClickHighImpression(pages, classifyUrl);
    expect(out.map((r) => r.url)).toEqual(["/zero"]);
  });
});

describe("期間比較: comparePages / winners・losers / E・F・G", () => {
  const current = new Map([
    ["/up", metrics(20, 500, 5)], // クリック増・順位改善
    ["/down", metrics(1, 500, 20)], // クリック減・順位悪化
    ["/new", metrics(2, 60, 8)], // 新規露出
  ]);
  const prev = new Map([
    ["/up", metrics(5, 500, 12)],
    ["/down", metrics(10, 500, 5)],
  ]);
  const diffs = comparePages(current, prev, classifyUrl);

  it("winners はクリック増加順、losers は減少順", () => {
    expect(topWinners(diffs, 10)[0].url).toBe("/up");
    expect(topLosers(diffs, 10)[0].url).toBe("/down");
  });

  it("Opportunity E: 順位が3以上改善したページを抽出する", () => {
    const improved = findPositionImprove(diffs, { minDelta: 3, minImpressions: 20 });
    expect(improved.map((r) => r.url)).toEqual(["/up"]);
  });

  it("Opportunity F: 順位が3以上悪化したページを抽出する", () => {
    const declined = findPositionDecline(diffs, { minDelta: 3, minImpressions: 20 });
    expect(declined.map((r) => r.url)).toEqual(["/down"]);
  });

  it("Opportunity G: 前期間 impressions=0 だったページを新規露出として抽出する", () => {
    const newVis = findNewVisibility(diffs, { minImpressions: 1 });
    expect(newVis.map((r) => r.url)).toEqual(["/new"]);
  });
});
