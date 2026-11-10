import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function headers(enabled = "true", environment = "production") {
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", enabled);
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_RANKING_SLOT_ID", "1234567890");
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_AREA_SLOT_ID", "0987654321");
  vi.stubEnv("VERCEL_ENV", environment);
  vi.resetModules();
  // Next の設定ファイルは JS。実際に生成するヘッダーを検証する。
  const { default: config } = await import("../../next.config.mjs");
  return config.headers();
}

describe("広告ページのCSP", () => {
  it("広告無効またはPreviewでは従来CSPだけを返す", async () => {
    for (const entries of [await headers("false"), await headers("true", "preview")]) {
      expect(entries).toHaveLength(1);
      expect(entries[0].headers[0].value).toContain("default-src 'self'");
    }
  });
  it("本番の設定済みページ群にだけ緩和したCSPを上書きする", async () => {
    const entries = await headers();
    expect(entries[0].headers[0].value).toContain("default-src 'self'");
    expect(entries.slice(1).map((entry: { source: string }) => entry.source)).toEqual([
      "/ranking/:metric", "/ranking/:metric/:pref", "/area/:pref", "/area/:pref/:city(\\d{5})",
    ]);
    for (const entry of entries.slice(1)) {
      expect(entry.headers[0].value).not.toContain("default-src");
      expect(entry.headers[0].value).toContain("object-src 'none'");
      expect(entry.headers[0].value).toContain("frame-ancestors 'none'");
    }
  });
});
