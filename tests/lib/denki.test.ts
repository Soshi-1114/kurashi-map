import { describe, it, expect } from "vitest";
import {
  DENKI_AREAS,
  DENKI_AREA_LABELS,
  PREF_TO_AREA,
  AREA_EXCEPTIONS,
  areaForMuni,
  validateDenkiPlans,
} from "@/lib/denki";
import type { DenkiPlansFile, DenkiAreaPricing } from "@/lib/denki";
import { PREFS } from "@/lib/prefs";

describe("PREF_TO_AREA", () => {
  it("全47県のマッピングがある", () => {
    for (const p of PREFS) {
      expect(PREF_TO_AREA[p.codePrefix], p.nameJa).toBeDefined();
    }
    expect(Object.keys(PREF_TO_AREA)).toHaveLength(47);
  });
  it("よく間違えやすい県: 新潟=東北、山梨=東京、三重=中部", () => {
    expect(PREF_TO_AREA["15"]).toBe("tohoku");
    expect(PREF_TO_AREA["19"]).toBe("tokyo");
    expect(PREF_TO_AREA["24"]).toBe("chubu");
  });
});

describe("areaForMuni", () => {
  it("県既定で判定される（例外なし自治体）", () => {
    expect(areaForMuni("13104")?.area).toBe("tokyo"); // 新宿区
    expect(areaForMuni("27100")?.area).toBe("kansai"); // 大阪市
    expect(areaForMuni("47201")?.area).toBe("okinawa"); // 那覇市
    expect(areaForMuni("01100")?.area).toBe("hokkaido"); // 札幌市
  });
  it("政令市の行政区コードも先頭2桁で判定できる", () => {
    expect(areaForMuni("14104")?.area).toBe("tokyo"); // 横浜市中区
  });
  it("label はエリア表示名", () => {
    expect(areaForMuni("13104")?.label).toBe(DENKI_AREA_LABELS.tokyo);
  });
  it("不正コードは null", () => {
    expect(areaForMuni("1310")).toBeNull();
    expect(areaForMuni("abcde")).toBeNull();
    expect(areaForMuni("")).toBeNull();
  });
  it("存在しない県プレフィックスは null", () => {
    expect(areaForMuni("99999")).toBeNull();
  });
  it("代表的な例外自治体の判定（2026-08-16 公式ページ確認値）", () => {
    expect(areaForMuni("22203")?.area).toBe("tokyo"); // 沼津市（富士川以東）
    expect(areaForMuni("22201")?.area).toBe("chubu"); // 静岡市（例外ではない）
    expect(areaForMuni("18204")?.area).toBe("kansai"); // 小浜市（嶺南）
    expect(areaForMuni("18202")?.area).toBe("hokuriku"); // 敦賀市（嶺南だが北陸側）
    expect(areaForMuni("24562")?.area).toBe("kansai"); // 紀宝町
    expect(areaForMuni("37364")?.area).toBe("chugoku"); // 直島町
    expect(areaForMuni("15216")?.area).toBe("tohoku"); // 糸魚川市（市区町村単位では例外なし）
    // 富士市は市域内で東西に分かれる
    const fuji = areaForMuni("22210")!;
    expect(fuji.area).toBe("tokyo");
    expect(fuji.altArea).toBe("chubu");
    expect(fuji.note).toBeTruthy();
  });

  it("例外自治体は AREA_EXCEPTIONS が優先される", () => {
    for (const [code, ex] of Object.entries(AREA_EXCEPTIONS)) {
      const r = areaForMuni(code);
      expect(r?.area, code).toBe(ex.area);
      expect(r?.altArea, code).toBe(ex.altArea);
      if (ex.altArea) expect(ex.note, `${code}: altArea があるなら note 必須`).toBeTruthy();
      expect(ex.source, `${code}: 出典必須`).toMatch(/^https?:\/\//);
    }
  });
  it("例外リストのコードは5桁で、既定と異なる情報を持つ", () => {
    for (const [code, ex] of Object.entries(AREA_EXCEPTIONS)) {
      expect(code).toMatch(/^\d{5}$/);
      const prefDefault = PREF_TO_AREA[code.slice(0, 2)];
      // 主エリアが県既定と同じなら altArea（一部別エリア）があるはず。
      // どちらも既定どおりならそのエントリは不要。
      expect(ex.area !== prefDefault || ex.altArea !== undefined, `${code}: 例外の意味がない`).toBe(true);
    }
  });
});

describe("validateDenkiPlans", () => {
  const pricing: DenkiAreaPricing = {
    basic: { type: "ampere", yenPerMonth: { "30": 900, "40": 1200, "50": 1500 } },
    tiers: [
      { upTo: 120, yenPerKwh: 20 },
      { upTo: 300, yenPerKwh: 25 },
      { upTo: null, yenPerKwh: 28 },
    ],
  };
  const validFile = (): DenkiPlansFile => ({
    asOf: "2026-08",
    plans: [
      {
        offerId: "baseline-all",
        company: "大手",
        planName: "従量電灯",
        kind: "baseline",
        areas: Object.fromEntries(DENKI_AREAS.map((a) => [a, pricing])),
        officialUrl: "https://example.com/",
        sourceUrl: "https://example.com/",
        sourceAsOf: "2026-08-01",
      },
    ],
  });

  it("正しいファイルはエラーなし", () => {
    expect(validateDenkiPlans(validFile())).toEqual([]);
  });
  it("baseline が欠けるエリアを検出", () => {
    const f = validFile();
    delete f.plans[0].areas.okinawa;
    expect(validateDenkiPlans(f).join("\n")).toContain("okinawa の baseline がない");
  });
  it("offerId 重複を検出", () => {
    const f = validFile();
    f.plans.push({ ...f.plans[0], kind: "offer" });
    expect(validateDenkiPlans(f).join("\n")).toContain("重複");
  });
  it("単価 0 を検出", () => {
    const f = validFile();
    f.plans[0].areas.tokyo = {
      ...pricing,
      tiers: [{ upTo: null, yenPerKwh: 0 }],
    };
    expect(validateDenkiPlans(f).join("\n")).toContain("単価が正でない");
  });
  it("段階の upTo が昇順でないのを検出", () => {
    const f = validFile();
    f.plans[0].areas.tokyo = {
      ...pricing,
      tiers: [
        { upTo: 300, yenPerKwh: 20 },
        { upTo: 120, yenPerKwh: 25 },
        { upTo: null, yenPerKwh: 28 },
      ],
    };
    expect(validateDenkiPlans(f).join("\n")).toContain("昇順でない");
  });
  it("最終段階の upTo が null でないのを検出", () => {
    const f = validFile();
    f.plans[0].areas.tokyo = {
      ...pricing,
      tiers: [{ upTo: 120, yenPerKwh: 20 }],
    };
    expect(validateDenkiPlans(f).join("\n")).toContain("null であるべき");
  });
  it("asOf の形式違反を検出", () => {
    const f = validFile();
    f.asOf = "2026/08";
    expect(validateDenkiPlans(f).join("\n")).toContain("YYYY-MM");
  });
});
