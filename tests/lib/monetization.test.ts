import { describe, it, expect, afterEach } from "vitest";
import { generateFurusatoUrl, supportUrl } from "@/lib/monetization";

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
