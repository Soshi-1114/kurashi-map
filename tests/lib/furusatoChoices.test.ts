import { describe, expect, it, vi } from "vitest";
import { buildFurusatoChoices } from "@/lib/furusatoChoices";
import type { Municipality } from "@/lib/types";
import type { FurusatoLinkInfo } from "@/lib/monetization";
const municipal = (url: string | null): FurusatoLinkInfo | null => url ? { url, kind: "municipal", impressionPixel: null } : null;
const city = { code: "01100", name: "札幌市", pref: "hokkaido" };
describe("ランキングの寄付先選択", () => {
  it("行政区を親市へ解決し、重複・未掲載の寄付先を除く", async () => {
    const parent = vi.fn(async () => city as Municipality);
    const choices = await buildFurusatoChoices([city, { ...city, code: "01101", name: "中央区", level: "ward", parentCode: "01100" }, { ...city, code: "99999" }], municipal, parent);
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({ code: "01100", name: "札幌市", label: "北海道 札幌市" });
    expect(parent).toHaveBeenCalledWith("01100");
  });
  it("表示済み10自治体に限定し、ポータルへしか進めない設定では候補を作らない", async () => {
    const resolve = vi.fn(municipal);
    await buildFurusatoChoices(Array.from({ length: 12 }, () => city), resolve);
    expect(resolve).toHaveBeenCalledTimes(10);
    expect(await buildFurusatoChoices([city], () => ({ url: "https://example.com/portal", kind: "portal", impressionPixel: null }))).toEqual([]);
  });
});
