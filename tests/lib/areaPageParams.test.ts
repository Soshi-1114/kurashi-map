import { describe, expect, it } from "vitest";
import AreaPage, { generateMetadata } from "@/app/area/[pref]/[city]/page";

const props = (pref: string, city: string) => ({
  params: Promise.resolve({ pref, city }),
});

// /area/{pref}/{code} は generateStaticParams で正しい組だけ生成されるが、
// dynamicParams が既定 true のため任意の pref との組み合わせ（/area/tokyo/11203 等）も
// オンデマンド生成されうる。pref 不一致を 404 にして重複 URL 空間（47 通り/自治体）を閉じる。
describe("/area/{pref}/{code} の pref 検証", () => {
  it("pref 不一致（/area/tokyo/11203 = 川口市）は notFound を投げる", async () => {
    await expect(AreaPage(props("tokyo", "11203"))).rejects.toThrowError();
  });

  it("pref 不一致の generateMetadata は 404 用タイトルを返す", async () => {
    const meta = await generateMetadata(props("tokyo", "11203"));
    expect(meta.title).toBe("見つかりません | KurashiMap");
  });

  it("正しい組（/area/saitama/11203）は描画される", async () => {
    const el = await AreaPage(props("saitama", "11203"));
    expect(el).toBeTruthy();
    const meta = await generateMetadata(props("saitama", "11203"));
    expect(String(meta.title)).toContain("川口市");
  });
});
