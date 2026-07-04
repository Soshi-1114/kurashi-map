import { describe, it, expect, vi, beforeEach } from "vitest";
import { muni, metric } from "../_fixtures";

// データアクセス層（pref 別動的 import + キャッシュ）のユニットテスト。
// 実 data/ は読まず lib/prefs をモックし、「code → pref 解決」「muni/wards 両方の
// 探索」「同一 pref の重複ロード防止」「サマリの軽量射影」を検証する。
// metrics.ts のキャッシュはモジュールスコープなので、テストごとに resetModules で
// 新しいインスタンスを import する。

const mockLoadPrefData = vi.fn();

vi.mock("@/lib/prefs", () => {
  const PREFS = [
    { slug: "saitama", nameJa: "埼玉県", codePrefix: "11", hasWards: true },
    { slug: "chiba", nameJa: "千葉県", codePrefix: "12", hasWards: false },
  ];
  return {
    PREFS,
    getPrefBySlug: (slug: string) => PREFS.find((p) => p.slug === slug) ?? null,
    getPrefByCode: (code: string) => PREFS.find((p) => p.codePrefix === code.slice(0, 2)) ?? null,
    loadPrefData: (...args: unknown[]) => mockLoadPrefData(...args),
  };
});

const kawaguchi = muni({ code: "11203", name: "川口市" });
const urawa = muni({ code: "11107", name: "浦和区", level: "ward", parentCode: "11100" });
const chibaCity = muni({ code: "12100", pref: "chiba", name: "千葉市" });

async function freshMetrics() {
  vi.resetModules();
  return import("@/lib/metrics");
}

beforeEach(() => {
  mockLoadPrefData.mockReset();
  mockLoadPrefData.mockImplementation(async (slug: string) => {
    if (slug === "saitama") return { muni: [kawaguchi], wards: [urawa] };
    if (slug === "chiba") return { muni: [chibaCity], wards: [] };
    throw new Error(`unexpected slug: ${slug}`);
  });
});

describe("getMunicipality", () => {
  it("code の先頭2桁から pref を解決して該当自治体を返す", async () => {
    const { getMunicipality } = await freshMetrics();
    const m = await getMunicipality("11203");
    expect(m?.name).toBe("川口市");
    expect(mockLoadPrefData).toHaveBeenCalledWith("saitama", true);
  });

  it("行政区コードは wards 側から見つける", async () => {
    const { getMunicipality } = await freshMetrics();
    const m = await getMunicipality("11107");
    expect(m?.name).toBe("浦和区");
    expect(m?.level).toBe("ward");
  });

  it("未対応の県コードは null（データロードもしない）", async () => {
    const { getMunicipality } = await freshMetrics();
    expect(await getMunicipality("99999")).toBeNull();
    expect(mockLoadPrefData).not.toHaveBeenCalled();
  });

  it("県は合っているが存在しない code は null", async () => {
    const { getMunicipality } = await freshMetrics();
    expect(await getMunicipality("11999")).toBeNull();
  });
});

describe("pref キャッシュ", () => {
  it("同一 pref への複数アクセスで loadPrefData は1回しか呼ばれない", async () => {
    const { getMunicipality, listMunicipalities } = await freshMetrics();
    await getMunicipality("11203");
    await getMunicipality("11107");
    await listMunicipalities("saitama");
    expect(mockLoadPrefData).toHaveBeenCalledTimes(1);
  });

  it("異なる pref はそれぞれロードする", async () => {
    const { getMunicipality } = await freshMetrics();
    await getMunicipality("11203");
    await getMunicipality("12100");
    expect(mockLoadPrefData).toHaveBeenCalledTimes(2);
  });
});

describe("listAllAcrossPrefs / listSummaryAcrossPrefs", () => {
  it("全 pref の市区町村＋行政区を横断で返す", async () => {
    const { listAllAcrossPrefs } = await freshMetrics();
    const all = await listAllAcrossPrefs();
    expect(all.map((m) => m.code).sort()).toEqual(["11107", "11203", "12100"]);
  });

  it("サマリは軽量射影（フル Metric を持たず値のみ）＋人口比は2桁丸め", async () => {
    const { listSummaryAcrossPrefs } = await freshMetrics();
    const s = (await listSummaryAcrossPrefs()).find((x) => x.code === "11203")!;
    expect(s.rent).toBe(kawaguchi.rent.value);
    expect(s.landPrice).toBe(kawaguchi.landPrice.value);
    expect(s.populationTrend).toBe(kawaguchi.populationTrend);
    // 12000人 / 600000人 = 2.00%
    expect(s.foreignRatio).toBe(2);
    // フル Municipality のフィールドが漏れて配信サイズが膨らんでいないこと
    expect("hazard" in s).toBe(false);
    expect("population" in s).toBe(false);
  });

  it("在留外国人統計の対象外はサマリの人口比が -1（データなしセンチネル）", async () => {
    mockLoadPrefData.mockImplementation(async (slug: string) => ({
      muni:
        slug === "saitama"
          ? [muni({ code: "11999", foreignResidents: metric({ value: 0, source: "調査対象外" }) })]
          : [],
      wards: [],
    }));
    const { listSummaryAcrossPrefs } = await freshMetrics();
    const s = (await listSummaryAcrossPrefs()).find((x) => x.code === "11999")!;
    expect(s.foreignRatio).toBe(-1);
  });
});
