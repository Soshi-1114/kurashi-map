import { describe, it, expect } from "vitest";
import {
  parseAsOf,
  muniLastModified,
  latestLastModified,
  latestAsOf,
} from "@/lib/dataFreshness";
import { muni, metric, hazard } from "../_fixtures";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("parseAsOf", () => {
  it("完全な ISO 日付はそのまま採用", () => {
    expect(iso(parseAsOf("2025-04-01"))).toBe("2025-04-01");
  });
  it("年月 YYYY-MM は月初に丸める（denki-plans の asOf）", () => {
    expect(iso(parseAsOf("2026-08"))).toBe("2026-08-01");
  });
  it("西暦年のみは 1/1 に丸める", () => {
    expect(iso(parseAsOf("2024"))).toBe("2024-01-01");
    expect(iso(parseAsOf("2023年"))).toBe("2023-01-01");
  });
  it("令和N年(度)を西暦へ変換（令和1=2019）", () => {
    expect(iso(parseAsOf("令和5年度"))).toBe("2023-01-01");
    expect(iso(parseAsOf("令和1年"))).toBe("2019-01-01");
  });
  it("欠損センチネルや空は null", () => {
    expect(parseAsOf("-")).toBeNull();
    expect(parseAsOf("")).toBeNull();
    expect(parseAsOf("不明")).toBeNull();
  });
});

describe("muniLastModified", () => {
  it("各指標 asOf のうち最も新しい日付を返す", () => {
    const m = muni({
      rent: metric({ asOf: "2023" }),
      landPrice: metric({ asOf: "2025-04-01", unit: "円/㎡" }),
      waitlistChildren: metric({ asOf: "令和5年度", unit: "人" }),
      hazard: hazard({ asOf: "2024" }),
    });
    expect(iso(muniLastModified(m))).toBe("2025-04-01");
  });
  it("全 asOf がパース不能なら null", () => {
    const m = muni({
      rent: metric({ asOf: "-" }),
      landPrice: metric({ asOf: "-", unit: "円/㎡" }),
      waitlistChildren: metric({ asOf: "-", unit: "人" }),
      foreignResidents: metric({ asOf: "-", unit: "人" }),
      hazard: hazard({ asOf: "-" }),
    });
    expect(muniLastModified(m)).toBeNull();
  });
});

describe("latestLastModified", () => {
  it("自治体群を通じた最大 asOf を返す", () => {
    const list = [
      muni({ code: "A", rent: metric({ asOf: "2023" }) }),
      muni({ code: "B", rent: metric({ asOf: "2026" }) }),
      muni({ code: "C", rent: metric({ asOf: "2024" }) }),
    ];
    expect(iso(latestLastModified(list))).toBe("2026-01-01");
  });
  it("空配列は null", () => {
    expect(latestLastModified([])).toBeNull();
  });
});

describe("latestAsOf", () => {
  it("複数候補のうち最も新しい asOf を元の文字列のまま返す", () => {
    // 月まである方（2025-12）が年のみ（2025・2023）より新しい
    expect(latestAsOf(["2023", "2025-12", "2025"])).toBe("2025-12");
  });
  it("null/undefined/パース不能は無視する", () => {
    expect(latestAsOf([null, undefined, "-", "不明", "2024"])).toBe("2024");
  });
  it("1つも解釈できなければ null", () => {
    expect(latestAsOf([null, undefined, "-"])).toBeNull();
    expect(latestAsOf([])).toBeNull();
  });
});
