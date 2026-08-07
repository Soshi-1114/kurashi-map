import { describe, it, expect } from "vitest";
import { COMPARE_ROWS, COMPARE_GROUPS, type NationalAverages } from "@/lib/compareMetrics";
import { muni, metric, hazard } from "../_fixtures";
import type { Municipality } from "@/lib/types";

// 比較テーブルの行定義。honesty 方針の要: 欠損センチネルを値と区別して表示し、
// NaN / undefined がそのまま画面に出ないこと。

function valueOf(key: string, m: Municipality): string {
  const row = COMPARE_ROWS.find((r) => r.key === key);
  if (!row) throw new Error(`row not found: ${key}`);
  return row.value(m);
}

function nationalAvgOf(key: string, n: NationalAverages): string | undefined {
  const row = COMPARE_ROWS.find((r) => r.key === key);
  if (!row) throw new Error(`row not found: ${key}`);
  return row.nationalAvgText?.(n);
}

describe("COMPARE_ROWS", () => {
  const full = muni({
    population: 100000,
    populationChangeRate: -4.83,
    areaKm2: 50,
    rent: metric({ value: 45276 }),
    landPrice: metric({ value: 44513, unit: "円/㎡" }),
    vacancy: { rate: 13.8, vacant: 12610, total: 91180, source: "住宅・土地統計調査", asOf: "2023" },
    waitlistChildren: metric({ value: 0, unit: "人" }),
    foreignResidents: metric({ value: 2021, unit: "人", source: "出入国在留管理庁 在留外国人統計" }),
    amenities: {
      stations: 14, preschools: 98, medicalFacilities: 253,
      source: "国土数値情報（S12 駅・reinfolib XKT007 保育）・厚生労働省 医療施設調査",
      asOf: "2024",
    },
    shelters: { count: 472, source: "国土地理院「指定緊急避難場所データ」", asOf: "2026-06-19" },
    hazard: hazard({
      hasFloodRisk: true, hasLandslideRisk: true,
      floodLevel: 4, landslideLevel: 2,
      tsunamiLevel: 6, tsunamiDepth: "5m以上 ～ 10m未満",
      stormSurgeLevel: 0, stormSurgeDepth: "",
      liquefactionLevel: 1, liquefactionLabel: "非常に液状化しやすい",
    }),
  });

  it("完全データ: 各行が実データの表示文字列を返す", () => {
    expect(valueOf("population", full)).toBe("100,000人");
    expect(valueOf("populationChangeRate", full)).toBe("-4.8%");
    expect(valueOf("density", full)).toBe("2,000人/km²");
    expect(valueOf("area", full)).toBe("50km²");
    expect(valueOf("foreignRatio", full)).toBe("2.02%");
    expect(valueOf("rent", full)).toBe("45,276円/月");
    expect(valueOf("landPrice", full)).toBe("44,513円/㎡");
    expect(valueOf("vacancy", full)).toBe("13.8%");
    expect(valueOf("waitlist", full)).toBe("0人");
    expect(valueOf("stations", full)).toBe("14駅");
    expect(valueOf("shelters", full)).toBe("472か所");
    expect(valueOf("flood", full)).toBe("5〜10m");
    expect(valueOf("landslide", full)).toBe("特別警戒区域");
    expect(valueOf("tsunami", full)).toBe("最大 5m以上 ～ 10m未満");
    expect(valueOf("stormSurge", full)).toBe("想定なし");
    expect(valueOf("liquefaction", full)).toBe("非常に液状化しやすい");
  });

  it("欠損センチネル: データなし・対象外・未収録を値と区別して表示する", () => {
    const missing = muni({
      population: 0,
      // populationChangeRate / areaKm2 / vacancy / amenities / shelters なし
      rent: metric({ value: 0, source: "データなし（住宅統計の集計対象外）", asOf: "-" }),
      landPrice: metric({ value: 0, unit: "円/㎡", source: "対象外（北方領土・地価公示等の標準地なし）", asOf: "-" }),
      foreignResidents: metric({ value: 0, unit: "人", source: "対象外（北方領土）" }),
      hazard: hazard({ source: "対象外（北方領土・ハザード評価対象外）" }),
    });
    expect(valueOf("population", missing)).toBe("—");
    expect(valueOf("populationChangeRate", missing)).toBe("—");
    expect(valueOf("density", missing)).toBe("—");
    expect(valueOf("area", missing)).toBe("—");
    expect(valueOf("rent", missing)).toBe("データなし");
    expect(valueOf("landPrice", missing)).toBe("対象外");
    expect(valueOf("vacancy", missing)).toBe("対象外");
    expect(valueOf("foreignRatio", missing)).toBe("対象外");
    expect(valueOf("stations", missing)).toBe("対象外");
    expect(valueOf("shelters", missing)).toBe("未収録");
    expect(valueOf("flood", missing)).toBe("対象外");
    expect(valueOf("landslide", missing)).toBe("対象外");
    // 沿岸ハザードのフィールドなし → 対象外
    expect(valueOf("tsunami", missing)).toBe("対象外");
    expect(valueOf("liquefaction", missing)).toBe("対象外");
  });

  it("旧形式（boolean のみのハザード）は「想定あり/なし」で深さを騙らない", () => {
    const legacy = muni({ hazard: hazard({ hasFloodRisk: true }) }); // floodLevel なし
    expect(valueOf("flood", legacy)).toBe("想定あり");
    const legacyNone = muni({ hazard: hazard({ hasFloodRisk: false }) });
    expect(valueOf("flood", legacyNone)).toBe("想定なし");
  });

  it("人口増減率は正の値に + を付ける", () => {
    const growing = muni({ population: 1000, populationChangeRate: 3.21 });
    expect(valueOf("populationChangeRate", growing)).toBe("+3.2%");
  });

  it("全行が NaN / undefined を出力しない（完全・欠損の両ケース）", () => {
    const cases = [full, muni({ population: 0, rent: metric({ value: 0, source: "データなし" }) })];
    for (const m of cases) {
      for (const row of COMPARE_ROWS) {
        const v = row.value(m);
        expect(v, `${row.key} on ${m.code}`).not.toMatch(/NaN|undefined|null/);
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });

  it("全行のグループが COMPARE_GROUPS に含まれる", () => {
    for (const row of COMPARE_ROWS) {
      expect(COMPARE_GROUPS).toContain(row.group);
    }
  });
});

describe("nationalAvgText", () => {
  const avgs: NationalAverages = {
    rent: 55000,
    landPrice: 88000,
    populationChangeRate: -1.5,
    vacancyRate: 13.1,
    density: 1800,
    foreignRatio: 2.34,
  };
  const empty: NationalAverages = {
    rent: null, landPrice: null, populationChangeRate: null, vacancyRate: null, density: null, foreignRatio: null,
  };

  it("対象6指標は areaStats/foreignStats と同じ書式で表示する", () => {
    expect(nationalAvgOf("rent", avgs)).toBe("55,000円/月");
    expect(nationalAvgOf("landPrice", avgs)).toBe("88,000円/㎡");
    expect(nationalAvgOf("populationChangeRate", avgs)).toBe("-1.5%");
    expect(nationalAvgOf("vacancy", avgs)).toBe("13.1%");
    expect(nationalAvgOf("density", avgs)).toBe("1,800人/km²");
    expect(nationalAvgOf("foreignRatio", avgs)).toBe("2.34%");
  });

  it("増加率は + を付ける", () => {
    expect(nationalAvgOf("populationChangeRate", { ...avgs, populationChangeRate: 2.4 })).toBe("+2.4%");
  });

  it("値が null（未算出）なら「—」", () => {
    for (const key of ["rent", "landPrice", "populationChangeRate", "vacancy", "density", "foreignRatio"]) {
      expect(nationalAvgOf(key, empty)).toBe("—");
    }
  });

  it("母集団の意味が異なる指標（人口・面積・待機児童・災害リスク等）は nationalAvgText を持たない", () => {
    for (const key of ["population", "area", "waitlist", "stations", "preschools", "medical", "shelters", "flood", "landslide", "tsunami", "stormSurge", "liquefaction"]) {
      expect(nationalAvgOf(key, avgs)).toBeUndefined();
    }
  });
});
