import { describe, it, expect } from "vitest";
import { parseMapDeepLink, parseHazardDeepLink, mapHrefForHazards } from "@/lib/mapDeepLink";

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

describe("parseHazardDeepLink", () => {
  it("有効なオーバーレイ種別をカンマ区切りで返す", () => {
    expect(parseHazardDeepLink("?hazard=flood")).toEqual(["flood"]);
    expect(parseHazardDeepLink("?code=13104&hazard=flood,landslide")).toEqual(["flood", "landslide"]);
  });

  it("浸水系（洪水・津波・高潮）は排他選択なので最初の1件だけ残す", () => {
    expect(parseHazardDeepLink("?hazard=flood,tsunami,landslide")).toEqual(["flood", "landslide"]);
    expect(parseHazardDeepLink("?hazard=tsunami,stormSurge")).toEqual(["tsunami"]);
  });

  it("不正値・重複・オーバーレイ非対応の液状化は捨てる", () => {
    expect(parseHazardDeepLink("?hazard=liquefaction,foo,flood,flood")).toEqual(["flood"]);
    expect(parseHazardDeepLink("?hazard=none")).toEqual([]);
  });

  it("指定なし・空は空配列", () => {
    expect(parseHazardDeepLink("")).toEqual([]);
    expect(parseHazardDeepLink("?code=13104")).toEqual([]);
    expect(parseHazardDeepLink("?hazard=")).toEqual([]);
  });
});

describe("mapHrefForHazards", () => {
  it("code と hazard を組み合わせたトップ地図の URL を返す", () => {
    expect(mapHrefForHazards("13104", ["flood", "landslide"])).toBe("/?code=13104&hazard=flood,landslide");
  });
});
