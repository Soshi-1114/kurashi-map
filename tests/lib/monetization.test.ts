import { describe, it, expect, afterEach } from "vitest";
import { generateFurusatoUrl, supportUrl, furusatoUrlTemplate, denkiOfferUrl } from "@/lib/monetization";

// process.env を書き換えるテストは毎回クリーンアップする。
const KEYS = ["NEXT_PUBLIC_SUPPORT_URL", "NEXT_PUBLIC_FURUSATO_URL_TEMPLATE"] as const;
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

describe("generateFurusatoUrl", () => {
  it("デフォルトはさとふる検索URL・県名前置・UTM付与", () => {
    const url = generateFurusatoUrl("府中市", "東京都");
    expect(url).toContain("https://www.satofull.jp/search/?keyword=");
    // keyword は「東京都府中市」をURLエンコードしたもの
    expect(url).toContain(encodeURIComponent("東京都府中市"));
    expect(url).toContain("utm_source=kurashimap");
    expect(url).toContain("utm_medium=referral");
    expect(url).toContain("utm_campaign=furusato");
  });

  it("県名なしなら自治体名のみを keyword にする", () => {
    const url = generateFurusatoUrl("横浜市");
    expect(url).toContain(encodeURIComponent("横浜市"));
    expect(url).not.toContain(encodeURIComponent("神奈川県"));
  });

  it("同名自治体は県名前置で区別される", () => {
    const tokyo = generateFurusatoUrl("府中市", "東京都");
    const hiroshima = generateFurusatoUrl("府中市", "広島県");
    expect(tokyo).not.toBe(hiroshima);
  });

  it("テンプレート env の {keyword} を置換する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE =
      "https://furunavi.example/search?q={keyword}&aid=123";
    const url = generateFurusatoUrl("札幌市", "北海道");
    expect(url).toContain("https://furunavi.example/search?q=");
    expect(url).toContain(encodeURIComponent("北海道札幌市"));
    expect(url).toContain("aid=123");
    // 既に ? があるので UTM は & で連結
    expect(url).toContain("&utm_source=kurashimap");
  });

  it("{keyword} を含まない不正テンプレートはデフォルトにフォールバック", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://broken.example/";
    const url = generateFurusatoUrl("札幌市", "北海道");
    expect(url).toContain("https://www.satofull.jp/search/?keyword=");
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
