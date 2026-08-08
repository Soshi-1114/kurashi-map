import { describe, it, expect } from "vitest";
// @ts-expect-error mjs モジュール（データスクリプト共通ヘルパー）に型定義はない
import { toHiragana, collapseChome, townKanaToHiragana, cityKanaFromWardKanas, parseCsvLine } from "../../scripts/_lib/towns.mjs";

describe("collapseChome", () => {
  it("末尾の丁目表記を落として大字単位に畳む", () => {
    expect(collapseChome("旭ケ丘一丁目")).toBe("旭ケ丘");
    expect(collapseChome("西新宿二十三丁目")).toBe("西新宿");
    expect(collapseChome("青葉台")).toBe("青葉台");
  });

  it("名前全体が丁目表記のみなら畳まない", () => {
    expect(collapseChome("一丁目")).toBe("一丁目");
  });
});

describe("townKanaToHiragana", () => {
  it("末尾の丁目数字と空白を除去してひらがな化する", () => {
    expect(townKanaToHiragana("アサヒガオカ 1")).toBe("あさひがおか");
    expect(townKanaToHiragana("ヒノサト")).toBe("ひのさと");
    expect(townKanaToHiragana("")).toBe("");
  });
});

describe("cityKanaFromWardKanas", () => {
  it("区の読みの共通接頭辞から親市の読みを導出する", () => {
    expect(cityKanaFromWardKanas(["さかいしさかいく", "さかいしきたく"])).toBe("さかいし");
  });

  it("区名側の共通音で接頭辞が伸びても「最後のし」で打ち切る（名古屋市の中区/中村区/中川区）", () => {
    expect(cityKanaFromWardKanas(["なごやしなかく", "なごやしなかむらく", "なごやしなかがわく"])).toBe("なごやし");
  });

  it("導出できないケースは null", () => {
    expect(cityKanaFromWardKanas([])).toBe(null);
    expect(cityKanaFromWardKanas(["", ""])).toBe(null);
    expect(cityKanaFromWardKanas(["あいうえお", "あいうえか"])).toBe(null); // 「し」を含まない
  });
});

describe("parseCsvLine", () => {
  it("クォート囲み・非囲み・空フィールドの混在を分解する", () => {
    expect(parseCsvLine('"01","北海道",,"札幌市中央区",1.5')).toEqual(["01", "北海道", "", "札幌市中央区", "1.5"]);
  });

  it("囲み内のカンマと \"\" エスケープを扱う", () => {
    expect(parseCsvLine('"a,b","say ""hi""",c')).toEqual(["a,b", 'say "hi"', "c"]);
  });

  it("toHiragana はカタカナのみ変換する", () => {
    expect(toHiragana("ムナカタシ")).toBe("むなかたし");
    expect(toHiragana("宗像市")).toBe("宗像市");
  });
});
