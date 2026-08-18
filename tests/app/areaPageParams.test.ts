import { describe, expect, it } from "vitest";
import AreaPage, { generateMetadata } from "@/app/area/[pref]/[city]/page";

const props = (pref: string, city: string) => ({
  params: Promise.resolve({ pref, city }),
});

// pref スラッグ検証の本体は lib/metrics.ts の getMunicipalityIn（ユニットテストは
// tests/lib/metrics.test.ts）。ここではページへの配線（notFound / 404 メタデータ）を検証する。
describe("/area/{pref}/{code} の pref 検証", () => {
  it("pref 不一致（/area/tokyo/11203 = 川口市）は notFound を投げる", async () => {
    await expect(AreaPage(props("tokyo", "11203"))).rejects.toThrowError();
  });

  it("pref 不一致の generateMetadata は 404 用タイトルを返す", async () => {
    const meta = await generateMetadata(props("tokyo", "11203"));
    expect(meta.title).toBe("見つかりません | KurashiMap");
  });

  it("正しい組（/area/saitama/11203）は notFound にならず描画される", async () => {
    await expect(AreaPage(props("saitama", "11203"))).resolves.toBeTruthy();
  });

  it("正しい組の generateMetadata は自治体名入りタイトルを返す", async () => {
    const meta = await generateMetadata(props("saitama", "11203"));
    expect(String(meta.title)).toContain("川口市");
  });
});
