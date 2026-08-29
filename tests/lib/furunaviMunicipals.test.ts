import { describe, it, expect } from "vitest";
import data from "@/data/furunavi-municipals.json";
import { furunaviMunicipalId, furunaviMunicipalPageUrl, FURUNAVI_TOP_PAGE_URL } from "@/lib/furunaviMunicipals";

// scripts/fetch-furunavi-municipals.mjs の出力破損（空データ・キー形式崩れ）を検出する。
// 掲載自治体の増減があるため件数は幅で守る。
describe("data/furunavi-municipals.json", () => {
  const entries = Object.entries(data.byCode as Record<string, number>);

  it("1,000件以上の対応があり、出典・取得日を持つ", () => {
    expect(entries.length).toBeGreaterThan(1000);
    expect(data.source).toContain("ふるなび");
    expect(data.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("キーは5桁のJISコード、値は正の整数", () => {
    for (const [code, id] of entries) {
      expect(code, code).toMatch(/^\d{5}$/);
      expect(Number(code.slice(0, 2)), code).toBeGreaterThanOrEqual(1);
      expect(Number(code.slice(0, 2)), code).toBeLessThanOrEqual(47);
      expect(Number.isInteger(id), code).toBe(true);
      expect(id, code).toBeGreaterThan(0);
    }
  });

  it("政令市は親市のコードで載り、区のコードは載らない", () => {
    // 札幌市（01100）は掲載。区（01101 中央区）は対応表に含めない
    expect(furunaviMunicipalId("01100")).not.toBeNull();
    expect(furunaviMunicipalId("01101")).toBeNull();
  });

  it("未掲載・未知のコードは null", () => {
    expect(furunaviMunicipalId("99999")).toBeNull();
  });

  it("furunaviMunicipalPageUrl は自治体ページURL（AT向けutm付き）を返し、未掲載は null", () => {
    const url = furunaviMunicipalPageUrl("01100");
    expect(url).toContain("https://furunavi.jp/Municipal/Product/Search?municipalid=");
    expect(url).toContain("utm_source=at&utm_medium=affiliate&utm_campaign=default");
    expect(furunaviMunicipalPageUrl("99999")).toBeNull();
  });

  it("FURUNAVI_TOP_PAGE_URL はふるなびトップURL（AT向けutm付き）", () => {
    expect(FURUNAVI_TOP_PAGE_URL.startsWith("https://furunavi.jp/?")).toBe(true);
    expect(FURUNAVI_TOP_PAGE_URL).toContain("utm_source=at&utm_medium=affiliate&utm_campaign=default");
  });
});
