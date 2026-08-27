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
  // 札幌市のふるなびID（テスト用の任意値）
  const ID = 1;

  it("env 未設定なら null（導線非表示）", () => {
    expect(furusatoLink("札幌市", "北海道", ID)).toBeNull();
  });

  it("ふるなび未掲載（municipalId=null）なら env があっても null（誤誘導しない）", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://furunavi.example/search?q={keyword}";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(furusatoLink("北方村", "北海道", null)).toBeNull();
  });

  it("{url} テンプレート: ふるなび自治体ページをエンコードして埋め、municipal 種別になる", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://h.accesstrade.net/sp/ic?rk=abc&url={url}";
    const link = furusatoLink("札幌市", "北海道", ID);
    expect(link?.kind).toBe("municipal");
    expect(link?.url).toBe(
      "https://h.accesstrade.net/sp/ic?rk=abc&url=" +
        encodeURIComponent("https://furunavi.jp/Municipal/Product/Search?municipalid=1"),
    );
    // ASP リンクなので UTM は付けない
    expect(link?.url).not.toContain("utm_source");
  });

  it("{url} テンプレートが ASP 経由でなければ UTM を付与する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://redirect.example/?to={url}";
    const link = furusatoLink("札幌市", "北海道", ID);
    expect(link?.kind).toBe("municipal");
    expect(link?.url).toContain("utm_campaign=furusato");
  });

  it("{keyword} テンプレート: 県名+自治体名で置換し UTM を付与、search 種別になる", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE =
      "https://furunavi.example/search?q={keyword}&aid=123";
    const link = furusatoLink("府中市", "東京都", ID);
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
    const url = furusatoLink("横浜市", undefined, ID)?.url;
    expect(url).toContain(encodeURIComponent("横浜市"));
    expect(url).not.toContain(encodeURIComponent("神奈川県"));
  });

  it("ASP経由の {keyword} テンプレートには UTM を付けない（計測を壊さない）", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE =
      "https://h.accesstrade.net/sp/ic?rk=abc&url=https%3A%2F%2Ffurunavi.jp%2Fsearch%3Fq%3D{keyword}";
    const link = furusatoLink("札幌市", "北海道", ID);
    expect(link?.kind).toBe("search");
    expect(link?.url).toContain(encodeURIComponent("北海道札幌市"));
    expect(link?.url).not.toContain("utm_source");
  });

  it("固定リンクはそのまま返し（UTMなし）、portal 種別になる", () => {
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    const link = furusatoLink("札幌市", "北海道", ID);
    expect(link?.kind).toBe("portal");
    expect(link?.url).toBe("https://h.accesstrade.net/sp/cc?rk=abc");
  });

  it("テンプレートと固定リンクの両方があればテンプレートを優先する", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://h.accesstrade.net/sp/ic?rk=abc&url={url}";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(furusatoLink("札幌市", "北海道", ID)?.kind).toBe("municipal");
  });

  it("プレースホルダのない不正テンプレートは無視され、固定リンクにフォールバック", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://broken.example/";
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    expect(furusatoLink("札幌市", "北海道", ID)?.kind).toBe("portal");
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
