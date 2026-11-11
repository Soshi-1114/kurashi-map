// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { document.getElementById("kurashimap-adsense")?.remove(); vi.resetModules(); });

describe("AdSenseスクリプトのライフサイクル", () => {
  it("複数回呼んでも同じ非同期スクリプトだけを読み込む", async () => {
    const { loadAdsense } = await import("@/lib/adsenseLoader");
    const first = loadAdsense("ca-pub-5168889916977587");
    const second = loadAdsense("ca-pub-5168889916977587");
    expect(first).toBe(second);
    const scripts = document.querySelectorAll<HTMLScriptElement>("#kurashimap-adsense");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].async).toBe(true);
    expect(scripts[0].crossOrigin).toBe("anonymous");
    expect(scripts[0].src).toBe("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5168889916977587");
    scripts[0].dispatchEvent(new Event("load"));
    await expect(first).resolves.toBeUndefined();
  });
  it("広告ブロックで失敗した場合もリクエストを繰り返さない", async () => {
    const { loadAdsense } = await import("@/lib/adsenseLoader");
    const loading = loadAdsense("ca-pub-5168889916977587");
    const assertion = expect(loading).rejects.toThrow("AdSense script unavailable");
    document.getElementById("kurashimap-adsense")!.dispatchEvent(new Event("error"));
    await assertion;
    expect(loadAdsense("ca-pub-5168889916977587")).toBe(loading);
  });
});
