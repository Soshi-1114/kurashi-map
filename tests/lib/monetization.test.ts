import { describe, it, expect, afterEach } from "vitest";
import {
  furusatoLink,
  furusatoAffUrl,
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

describe("furusatoUrlTemplate / furusatoAffUrl", () => {
  it("未設定・空白のみは null（導線非表示）", () => {
    expect(furusatoUrlTemplate()).toBeNull();
    expect(furusatoAffUrl()).toBeNull();
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "  ";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "  ";
    expect(furusatoUrlTemplate()).toBeNull();
    expect(furusatoAffUrl()).toBeNull();
  });
  it("{url} を含まない不正テンプレートは null", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://broken.example/";
    expect(furusatoUrlTemplate()).toBeNull();
  });
  it("{url} を含むテンプレートはそのまま返す", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://h.accesstrade.net/sp/cc?rk=abc&url={url}";
    expect(furusatoUrlTemplate()).toBe("https://h.accesstrade.net/sp/cc?rk=abc&url={url}");
  });
});

describe("furusatoLink", () => {
  // ふるなび自治体ページ（lib/furunaviMunicipals.furunaviMunicipalPageUrl の戻り値相当）
  const DEST = "https://furunavi.jp/Municipal/Product/Search?municipalid=1&utm_source=at&utm_medium=affiliate&utm_campaign=default";

  it("env 未設定なら null（導線非表示）", () => {
    expect(furusatoLink(DEST)).toBeNull();
  });

  it("リンク先なし（ふるなび未掲載）なら env があっても null（誤誘導しない）", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://h.accesstrade.net/sp/cc?rk=abc&url={url}";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(furusatoLink(null)).toBeNull();
  });

  it("テンプレート: リンク先をエンコードして埋め、無加工のURLと計測ピクセルを返す", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://h.accesstrade.net/sp/cc?rk=abc&url={url}";
    const link = furusatoLink(DEST);
    expect(link?.kind).toBe("municipal");
    // AT 商品リンク一括作成の生成結果と同一のURLになる（UTM 等の加工なし）
    expect(link?.url).toBe("https://h.accesstrade.net/sp/cc?rk=abc&url=" + encodeURIComponent(DEST));
    expect(link?.url).not.toContain("utm_source=kurashimap");
    // クリックリンク（sp/cc）と対のインプレッションピクセル（sp/rr）
    expect(link?.impressionPixel).toBe("https://h.accesstrade.net/sp/rr?rk=abc");
  });

  it("AT 以外のリンクでは計測ピクセルは null", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://redirect.example/?to={url}";
    expect(furusatoLink(DEST)?.impressionPixel).toBeNull();
  });

  it("固定リンクはそのまま返し、portal 種別になる", () => {
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    const link = furusatoLink(DEST);
    expect(link?.kind).toBe("portal");
    expect(link?.url).toBe("https://h.accesstrade.net/sp/cc?rk=abc");
    expect(link?.impressionPixel).toBe("https://h.accesstrade.net/sp/rr?rk=abc");
  });

  it("テンプレートと固定リンクの両方があればテンプレートを優先する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://h.accesstrade.net/sp/cc?rk=abc&url={url}";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=xyz";
    expect(furusatoLink(DEST)?.kind).toBe("municipal");
  });

  it("不正テンプレートは無視され、固定リンクにフォールバック", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://broken.example/";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(furusatoLink(DEST)?.kind).toBe("portal");
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
