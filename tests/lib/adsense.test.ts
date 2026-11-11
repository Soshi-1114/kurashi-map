import { afterEach, describe, expect, it, vi } from "vitest";
import { adPageGroup, canServeAds, hasAdsForPath, requiresDocumentNavigation, resolveAdsenseConfig } from "@/lib/adsensePolicy.mjs";
import { GET } from "@/app/ads.txt/route";

afterEach(() => vi.unstubAllEnvs());
const input = { enabled: "true", production: "true", clientId: "ca-pub-5168889916977587", rankingSlot: "1234567890", areaSlot: "0987654321" };
const config = resolveAdsenseConfig(input);

describe("AdSense の配信境界", () => {
  it.each(["/", "/ranking", "/map", "/map/rent", "/compare", "/denki", "/shindan", "/bousai/stockpile", "/search", "/privacy", "/about", "/api/og", "/ranking/a/b/c", "/area/tokyo/not-a-code"])("操作・案内・不正パスでは広告を許可しない: %s", path => {
    expect(adPageGroup(path)).toBeNull();
    expect(hasAdsForPath(config, path)).toBe(false);
  });
  it.each(["/ranking/population-most", "/ranking/population-most/hokkaido", "/ranking/population-most/prefecture", "/area/tokyo", "/area/saitama/11203"])("閲覧ページを識別する: %s", path => {
    expect(hasAdsForPath(config, path)).toBe(true);
  });
  it("有効フラグと正確なIDを必要とし、未設定のページ群を有効にしない", () => {
    expect(resolveAdsenseConfig({ ...input, enabled: undefined }).enabled).toBe(false);
    expect(resolveAdsenseConfig({ ...input, clientId: "ca-pub-broken" }).enabled).toBe(false);
    const partial = resolveAdsenseConfig({ ...input, rankingSlot: "bad" });
    expect(hasAdsForPath(partial, "/ranking/population-most")).toBe(false);
    expect(hasAdsForPath(partial, "/area/saitama/11203")).toBe(true);
  });
  it("本番ビルド・正規ホスト・HTTPSがそろった場合だけ実配信する", () => {
    expect(canServeAds(config, { hostname: "kurashimap.jp", protocol: "https:" })).toBe(true);
    for (const hostname of ["localhost", "preview.vercel.app", "www.kurashimap.jp", "kurashimap.jp.example.com"]) {
      expect(canServeAds(config, { hostname, protocol: "https:" })).toBe(false);
    }
    expect(canServeAds(config, { hostname: "kurashimap.jp", protocol: "http:" })).toBe(false);
    expect(canServeAds({ ...config, production: false }, { hostname: "kurashimap.jp", protocol: "https:" })).toBe(false);
  });
  it("広告ページへの出入りと広告ページ間は文書遷移、アンカー・ツール操作は維持", () => {
    const url = (path: string) => new URL(path, "https://kurashimap.jp");
    for (const [a, b] of [["/", "/area/saitama/11203"], ["/ranking/population-most", "/compare?codes=11203"], ["/area/tokyo", "/area/saitama/11203"]]) {
      expect(requiresDocumentNavigation(config, url(a), url(b))).toBe(true);
    }
    for (const [a, b] of [["/compare?codes=11203", "/compare?codes=11203,11201"], ["/area/tokyo", "/area/tokyo#hazard"], ["/denki", "/compare"], ["/area/tokyo", "https://example.com/"]]) {
      expect(requiresDocumentNavigation(config, url(a), url(b))).toBe(false);
    }
    expect(requiresDocumentNavigation({ ...config, enabled: false }, url("/area/tokyo"), url("/denki"))).toBe(false);
  });
});

describe("所有権確認・ads.txt", () => {
  it("広告無効でも所有者提供IDを公開する", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    const { metadata } = await import("@/app/layout");
    expect(metadata.other?.["google-adsense-account"]).toBe("ca-pub-5168889916977587");
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("google.com, pub-5168889916977587, DIRECT, f08c47fec0942fa0\n");
  });
  it("不正なパブリッシャーIDを公開しない", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "invalid");
    expect(GET().status).toBe(404);
  });
});
