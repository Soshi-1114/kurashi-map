import { describe, it, expect, afterEach } from "vitest";
import {
  furusatoLink,
  furusatoAffUrl,
  hasFurusatoLink,
  supportUrl,
  furusatoUrlTemplate,
  denkiOfferUrl,
} from "@/lib/monetization";

// process.env を書き換えるテストは毎回クリーンアップする。
const KEYS = [
  "NEXT_PUBLIC_SUPPORT_URL",
  "NEXT_PUBLIC_FURUSATO_URL_TEMPLATE",
  "NEXT_PUBLIC_FURUSATO_AFF_URL",
] as const;
afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("supportUrl", () => {
  it("未設定なら null", () => {
    expect(supportUrl()).toBeNull();
  });
  it("空白のみも null", () => {
    process.env.NEXT_PUBLIC_SUPPORT_URL = "  ";
    expect(supportUrl()).toBeNull();
  });
  it("設定値をそのまま返す", () => {
    process.env.NEXT_PUBLIC_SUPPORT_URL = "https://ofuse.me/kurashimap";
    expect(supportUrl()).toBe("https://ofuse.me/kurashimap");
  });
});

describe("furusatoUrlTemplate", () => {
  it("未設定なら null（導線非表示）", () => {
    expect(furusatoUrlTemplate()).toBeNull();
  });
  it("空白のみも null", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "  ";
    expect(furusatoUrlTemplate()).toBeNull();
  });
  it("{keyword} を含まない不正テンプレートは null", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://broken.example/";
    expect(furusatoUrlTemplate()).toBeNull();
  });
  it("{keyword} を含むテンプレートはそのまま返す", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://furunavi.example/search?q={keyword}";
    expect(furusatoUrlTemplate()).toBe("https://furunavi.example/search?q={keyword}");
  });
});

describe("furusatoAffUrl / hasFurusatoLink", () => {
  it("未設定なら null / false（導線非表示）", () => {
    expect(furusatoAffUrl()).toBeNull();
    expect(hasFurusatoLink()).toBe(false);
  });
  it("空白のみも null", () => {
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "  ";
    expect(furusatoAffUrl()).toBeNull();
    expect(hasFurusatoLink()).toBe(false);
  });
  it("固定リンクだけでも点灯する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(hasFurusatoLink()).toBe(true);
  });
  it("テンプレートだけでも点灯する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://furunavi.example/search?q={keyword}";
    expect(hasFurusatoLink()).toBe(true);
  });
});

describe("furusatoLink", () => {
  it("env 未設定なら null（導線非表示）", () => {
    expect(furusatoLink("札幌市", "北海道")).toBeNull();
  });

  it("テンプレートの {keyword} を県名+自治体名で置換し UTM を付与する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE =
      "https://furunavi.example/search?q={keyword}&aid=123";
    const link = furusatoLink("府中市", "東京都");
    expect(link?.kind).toBe("search");
    expect(link?.url).toContain("https://furunavi.example/search?q=");
    expect(link?.url).toContain(encodeURIComponent("東京都府中市"));
    expect(link?.url).toContain("aid=123");
    // 既に ? があるので UTM は & で連結
    expect(link?.url).toContain("&utm_source=kurashimap");
    expect(link?.url).toContain("utm_campaign=furusato");
  });

  it("県名なしなら自治体名のみを keyword にする", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://furunavi.example/search?q={keyword}";
    const url = furusatoLink("横浜市")?.url;
    expect(url).toContain(encodeURIComponent("横浜市"));
    expect(url).not.toContain(encodeURIComponent("神奈川県"));
  });

  it("同名自治体は県名前置で区別される", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://furunavi.example/search?q={keyword}";
    expect(furusatoLink("府中市", "東京都")?.url).not.toBe(furusatoLink("府中市", "広島県")?.url);
  });

  it("ASP経由のテンプレートには UTM を付けない（計測を壊さない）", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE =
      "https://h.accesstrade.net/sp/ic?rk=abc&url=https%3A%2F%2Ffurunavi.jp%2Fsearch%3Fq%3D{keyword}";
    const link = furusatoLink("札幌市", "北海道");
    expect(link?.kind).toBe("search");
    expect(link?.url).toContain(encodeURIComponent("北海道札幌市"));
    expect(link?.url).not.toContain("utm_source");
  });

  it("固定リンクはそのまま返し（UTMなし）、portal 種別になる", () => {
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    const link = furusatoLink("札幌市", "北海道");
    expect(link?.kind).toBe("portal");
    expect(link?.url).toBe("https://h.accesstrade.net/sp/cc?rk=abc");
  });

  it("テンプレートと固定リンクの両方があればテンプレートを優先する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://furunavi.example/search?q={keyword}";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(furusatoLink("札幌市", "北海道")?.kind).toBe("search");
  });

  it("{keyword} を含まない不正テンプレートは無視され、固定リンクにフォールバック", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://broken.example/";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(furusatoLink("札幌市", "北海道")?.kind).toBe("portal");
  });
});

describe("denkiOfferUrl", () => {
  it("提携リンク未設定なら公式サイトへの素リンク + UTM", () => {
    const { url, isAffiliate } = denkiOfferUrl("unknown-offer", "https://example.com/plan");
    expect(isAffiliate).toBe(false);
    expect(url).toContain("https://example.com/plan?");
    expect(url).toContain("utm_source=kurashimap");
    expect(url).toContain("utm_campaign=denki");
  });
  it("公式URLに ? があれば & で連結", () => {
    const { url } = denkiOfferUrl("unknown-offer", "https://example.com/plan?id=1");
    expect(url).toContain("plan?id=1&utm_source=kurashimap");
  });
  it("提携リンクがあればそのまま使い、UTM は付けない（ASP 計測を壊さない）", () => {
    const { url, isAffiliate } = denkiOfferUrl("looop", "https://example.com/plan", {
      looop: "https://aff.example/track?id=abc",
    });
    expect(isAffiliate).toBe(true);
    expect(url).toBe("https://aff.example/track?id=abc");
    expect(url).not.toContain("utm_source");
  });
  it("提携リンクが空白のみならフォールバック", () => {
    const { isAffiliate } = denkiOfferUrl("looop", "https://example.com/plan", { looop: "  " });
    expect(isAffiliate).toBe(false);
  });
});
