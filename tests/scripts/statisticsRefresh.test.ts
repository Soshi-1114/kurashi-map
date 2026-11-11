import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { censusValues, populationTrend } from "../../scripts/_lib/population.mjs";
import { parseAreaCsv } from "../../scripts/_lib/area.mjs";
import { wardWaitlist } from "../../scripts/_lib/waitlist.mjs";
import { isWaitlistDisclosed } from "../../lib/waitlist";
import { parseMedicalCsv } from "../../scripts/_lib/medical.mjs";

// e-Stat 0004065881/0004065882（2026-09-29公表、原数値）の抜粋。
const row = { "@tab": "2025_01", "@cat01": "0", "@area": "24201", "@time": "2025000000", "@unit": "人", "$": "263544" };
const sd = (rows: Record<string, string>[]) => ({ DATA_INF: { VALUE: rows } });
describe("2025年国勢調査 基本集計", () => {
  it("津市の基本集計人口を読み、速報263923人と区別する", () => {
    expect(censusValues(sd([row]), { tab: "2025_01", unit: "人" }).get("24201")).toBe(263544);
  });
  it("双葉町の算出不能な増減率を0や横ばいに置換しない", () => {
    const r = { "@tab": "2025_35", "@area": "07546", "@time": "2025000000", "@unit": "％", "$": "-" };
    expect(censusValues(sd([r]), { tab: "2025_35", unit: "％" }).get("07546")).toBeNull();
    expect(censusValues(sd([{ ...r, "@area": "24201", "$": "-4.00420" }]), { tab: "2025_35", unit: "％" }).get("24201")).toBe(-4.0042);
    expect(populationTrend(-4.0042)).toBe("減少");
  });
  it("男女・年次の混入と地域重複で更新を止める", () => {
    for (const r of [{ ...row, "@cat01": "1" }, { ...row, "@time": "2020000000" }]) {
      expect(() => censusValues(sd([r]), { tab: "2025_01", unit: "人" })).toThrow();
    }
    expect(() => censusValues(sd([row, row]), { tab: "2025_01", unit: "人" })).toThrow(/重複/);
  });
});

describe("面積調の基準日", () => {
  const csv = "\uFEFF標準地域コード,都道府県,郡,市区町村,令和8年7月1日(k㎡),備考,令和8年4月1日(k㎡)\n1100,北海道,,札幌市,1121.26,,1121.26\n24201,三重県,,津市,711.18,,711.18";
  it("公式UTF-8 BOM形式と4桁地域コードを読む", () => {
    expect(parseAreaCsv(Buffer.from(csv), "2026-07-01").get("01100")).toBe(1121.26);
  });
  it("最新列と設定の基準日がずれたら保存前に止める", () => {
    expect(() => parseAreaCsv(Buffer.from(csv), "2026-04-01")).toThrow(/一致/);
  });
});

describe("CFAの区別非公表", () => {
  it("福岡市1人を各区の0人として表示させない", () => {
    const metric = wardWaitlist({ name: "福岡市", waitlistChildren: { value: 1 } }, "2026-04-01");
    expect(isWaitlistDisclosed(metric)).toBe(false);
    expect(metric.source).toContain("福岡市全体で 1人");
    expect(metric.asOf).toBe("2026-04-01");
  });
  it("市全体0人の場合は区も0人として扱う", () => {
    expect(isWaitlistDisclosed(wardWaitlist({ name: "横浜市", waitlistChildren: { value: 0 } }, "2026-04-01"))).toBe(true);
  });
});

describe("2025年医療施設調査 市区町村編CSV", () => {
  // 公式CSV N1/N2の表題・函館市・北斗市行をShift-JISのまま保存した抜粋。
  const hospital = readFileSync("tests/fixtures/statistics/medical-2025-hosp.csv");
  const clinic = readFileSync("tests/fixtures/statistics/medical-2025-clinic.csv");
  it("実際の施設数を読み、施設なしの記号を0として集計する", () => {
    const h = parseMedicalCsv(hospital, "hospital", "2025年10月");
    const c = parseMedicalCsv(clinic, "clinic", "2025年10月");
    expect(h.get("01202")).toBe(26);
    expect(c.get("01202")).toBe(305);
    expect(h.get("01236")).toBe(0);
    expect(c.get("01236")).toBe(38);
  });
  it("基準日や表番号が違うCSVを拒否する", () => {
    expect(() => parseMedicalCsv(hospital, "hospital", "2024年10月")).toThrow();
    expect(() => parseMedicalCsv(clinic, "hospital", "2025年10月")).toThrow();
  });
});
