import { describe, it, expect } from "vitest";
import { parseMapDeepLink, mapHrefForCode, mapHrefForPref } from "@/lib/mapDeepLink";

describe("parseMapDeepLink", () => {
  it("?code= の5桁コードを code リンクとして返す", () => {
    expect(parseMapDeepLink("?code=11100")).toEqual({ kind: "code", code: "11100" });
  });

  it("政令市の区コード（5桁）も通す", () => {
    expect(parseMapDeepLink("?code=14104")).toEqual({ kind: "code", code: "14104" });
  });

  it("?pref= の有効な slug を pref リンクとして返す", () => {
    expect(parseMapDeepLink("?pref=saitama")).toEqual({ kind: "pref", slug: "saitama" });
    expect(parseMapDeepLink("?pref=hokkaido")).toEqual({ kind: "pref", slug: "hokkaido" });
  });

  it("code と pref が両方ある場合は code を優先する", () => {
    expect(parseMapDeepLink("?pref=saitama&code=13104")).toEqual({ kind: "code", code: "13104" });
  });

  it("code が不正な形式なら pref にフォールバックする", () => {
    expect(parseMapDeepLink("?code=123&pref=saitama")).toEqual({ kind: "pref", slug: "saitama" });
  });

  it("不正値は null（5桁でない code・存在しない pref slug・空）", () => {
    expect(parseMapDeepLink("?code=1234")).toBeNull();
    expect(parseMapDeepLink("?code=123456")).toBeNull();
    expect(parseMapDeepLink("?code=abcde")).toBeNull();
    expect(parseMapDeepLink("?pref=foo")).toBeNull();
    expect(parseMapDeepLink("?pref=")).toBeNull();
    expect(parseMapDeepLink("")).toBeNull();
    expect(parseMapDeepLink("?other=1")).toBeNull();
  });
});

describe("mapHrefForCode / mapHrefForPref", () => {
  it("既定の行き先は汎用の全画面地図 /map", () => {
    expect(mapHrefForCode("13104")).toBe("/map?code=13104");
    expect(mapHrefForPref("saitama")).toBe("/map?pref=saitama");
  });

  it("path 指定で指標別ハブへもディープリンクできる", () => {
    expect(mapHrefForCode("13104", "/map/foreign-ratio")).toBe("/map/foreign-ratio?code=13104");
    expect(mapHrefForPref("saitama", "/map/rent")).toBe("/map/rent?pref=saitama");
  });
});
