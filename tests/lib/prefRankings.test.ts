import { describe, it, expect } from "vitest";
import {
  PREF_RANKINGS,
  getPrefRankingBySlug,
  hasPrefRanking,
  buildPrefRankingRows,
} from "@/lib/prefRankings";
import { RANKINGS } from "@/lib/rankings";
import { muni, metric } from "../_fixtures";

// 都道府県ランキングの要は「率の平均ではなく実数の比」であること。
// 県内中央値（lib/prefAggregates.ts）とは別物で、こちらは県そのものの値を出す。
describe("prefRankings", () => {
  it("すべての slug が市区町村ランキングにも存在する（相互リンクが 404 にならない）", () => {
    for (const def of PREF_RANKINGS) {
      expect(RANKINGS.some((r) => r.slug === def.slug), def.slug).toBe(true);
    }
  });

  it("slug は重複しない", () => {
    const slugs = PREF_RANKINGS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("getPrefRankingBySlug / hasPrefRanking は定義の有無をそのまま返す", () => {
    expect(getPrefRankingBySlug("vacancy-high")?.slug).toBe("vacancy-high");
    expect(getPrefRankingBySlug("rent-cheap")).toBeNull();
    expect(hasPrefRanking("aging-high")).toBe(true);
    // 家賃・地価・財政力指数は県値を出す重み／概念が無いため意図的に非対象
    expect(hasPrefRanking("rent-high")).toBe(false);
    expect(hasPrefRanking("land-price-high")).toBe(false);
    expect(hasPrefRanking("fiscal-strong")).toBe(false);
  });

  it("集計方法（method）を全定義が持つ（honesty: ページに必ず出す）", () => {
    for (const def of PREF_RANKINGS) {
      expect(def.method.length, def.slug).toBeGreaterThan(0);
    }
  });

  describe("高齢化率: 率の平均ではなく実人数の比で集計する", () => {
    const aging = getPrefRankingBySlug("aging-high")!;
    // 小さい町（高齢化率50%）と大きい市（高齢化率20%）。
    // 率の単純平均なら35%になるが、実人数の比なら 20.9% が正しい。
    const small = muni({
      code: "01201",
      pref: "hokkaido",
      ageStats: { young: 100, elderly: 500, total: 1000, source: "住基", asOf: "2026-01-01" },
    });
    const big = muni({
      code: "01202",
      pref: "hokkaido",
      ageStats: { young: 15000, elderly: 20000, total: 100000, source: "住基", asOf: "2026-01-01" },
    });

    it("実人数の合算比を返す", () => {
      // (500 + 20000) / (1000 + 100000) * 100 = 20.297...
      expect(aging.aggregate([small, big])).toBeCloseTo((20500 / 101000) * 100, 6);
    });

    it("率の単純平均（35%）にはならない", () => {
      expect(aging.aggregate([small, big])).not.toBeCloseTo(35, 1);
    });

    it("counts が欠損を弾く（aggregate は絞り込み済みの配列しか受け取らない）", () => {
      expect(aging.counts(small)).toBe(true);
      expect(aging.counts(muni({ code: "01203" }))).toBe(false);
    });
  });

  describe("空き家率: 調査対象外（rate=-1）を合算から外す", () => {
    const vacancy = getPrefRankingBySlug("vacancy-high")!;
    const counted = muni({
      code: "30201",
      pref: "wakayama",
      vacancy: { rate: 20, vacant: 200, total: 1000, source: "住宅・土地統計調査", asOf: "2023" },
    });
    const excluded = muni({
      code: "30301",
      pref: "wakayama",
      // 人口1.5万人未満の町村は市区町村集計の対象外（rate=-1 センチネル）
      vacancy: { rate: -1, vacant: 0, total: 0, source: "住宅・土地統計調査（対象外）", asOf: "2023" },
    });

    it("実経路（buildPrefRankingRows）で対象外の 0 を分母に混ぜない", () => {
      const rows = buildPrefRankingRows(vacancy, [counted, excluded]);
      expect(rows[0].value).toBeCloseTo(20, 6);
      expect(rows[0].covered).toBe(1);
      expect(rows[0].total).toBe(2);
    });

    it("counts は対象外を数えない（カバレッジ表示の母数）", () => {
      expect(vacancy.counts(counted)).toBe(true);
      expect(vacancy.counts(excluded)).toBe(false);
    });
  });

  describe("外国人住民比率: 対象外の自治体を分母にも入れない", () => {
    const foreign = getPrefRankingBySlug("foreign-ratio-high")!;
    const counted = muni({
      code: "13101",
      pref: "tokyo",
      population: 10000,
      foreignResidents: metric({ value: 500, source: "出入国在留管理庁 在留外国人統計" }),
    });
    // 北方領土6村は調査対象外（source センチネル）
    const excluded = muni({
      code: "01695",
      pref: "hokkaido",
      population: 0,
      foreignResidents: metric({ value: 0, source: "調査対象外" }),
    });

    it("実経路で対象自治体だけの比率になる（対象外は分母にも入らない）", () => {
      expect(foreign.counts(counted)).toBe(true);
      expect(foreign.counts(excluded)).toBe(false);
      expect(foreign.aggregate([counted])).toBeCloseTo(5, 6);
    });
  });

  describe("保育定員余裕率: 定員と利用児童数をそれぞれ合算する", () => {
    const childcare = getPrefRankingBySlug("childcare-capacity")!;
    const a = muni({
      code: "20201",
      pref: "nagano",
      childcare: {
        capacity: 1000, enrolled: 800,
        capacityAge0: 0, enrolledAge0: 0, capacityAge12: 0, enrolledAge12: 0,
        hiddenWaitlist: 0, source: "こども家庭庁", asOf: "2026-04-01",
      },
    });
    const b = muni({
      code: "20202",
      pref: "nagano",
      childcare: {
        capacity: 1000, enrolled: 1100, // 定員超過受け入れ（弾力運用）
        capacityAge0: 0, enrolledAge0: 0, capacityAge12: 0, enrolledAge12: 0,
        hiddenWaitlist: 0, source: "こども家庭庁", asOf: "2026-04-01",
      },
    });

    it("(定員合計 − 利用合計) ÷ 定員合計。定員超過は負の実データとしてそのまま効く", () => {
      // (2000 - 1900) / 2000 * 100 = 5
      expect(childcare.aggregate([a, b])).toBeCloseTo(5, 6);
    });
  });

  describe("人口密度: 人口合計 ÷ 面積合計（密度の平均ではない）", () => {
    const density = getPrefRankingBySlug("population-density")!;
    const dense = muni({ code: "13101", pref: "tokyo", population: 100000, areaKm2: 10 });
    const sparse = muni({ code: "13102", pref: "tokyo", population: 1000, areaKm2: 1000 });

    it("実数の比で算出する", () => {
      // 101000 / 1010 = 100
      expect(density.aggregate([dense, sparse])).toBeCloseTo(100, 6);
    });

    it("密度の単純平均（約5000）にはならない", () => {
      expect(density.aggregate([dense, sparse])).toBeLessThan(1000);
    });

    it("面積が無い自治体は counts が弾く（populationDensity と同じ判定）", () => {
      const noArea = muni({ code: "13103", pref: "tokyo", population: 999999 });
      expect(density.counts(dense)).toBe(true);
      expect(density.counts(noArea)).toBe(false);
      // 実経路（buildPrefRankingRows）では分子にも分母にも入らない
      const rows = buildPrefRankingRows(density, [dense, noArea]);
      expect(rows[0].value).toBeCloseTo(10000, 6);
      expect(rows[0].covered).toBe(1);
      expect(rows[0].total).toBe(2);
    });
  });

  describe("buildPrefRankingRows", () => {
    const aging = getPrefRankingBySlug("aging-high")!;
    const rows = () =>
      buildPrefRankingRows(aging, [
        muni({
          code: "01201", pref: "hokkaido",
          ageStats: { young: 10, elderly: 300, total: 1000, source: "住基", asOf: "2026-01-01" },
        }),
        muni({
          code: "13101", pref: "tokyo",
          ageStats: { young: 10, elderly: 100, total: 1000, source: "住基", asOf: "2026-01-01" },
        }),
        // データなしの県は行ごと落とす（0% として最下位に並べない）
        muni({ code: "27101", pref: "osaka" }),
      ]);

    it("order=desc で大きい順に並ぶ", () => {
      expect(rows().map((r) => r.prefSlug)).toEqual(["hokkaido", "tokyo"]);
    });

    it("値が算出できない都道府県は行に含めない", () => {
      expect(rows().some((r) => r.prefSlug === "osaka")).toBe(false);
    });

    it("covered / total は対象自治体数と県内自治体数", () => {
      const r = buildPrefRankingRows(aging, [
        muni({
          code: "01201", pref: "hokkaido",
          ageStats: { young: 10, elderly: 300, total: 1000, source: "住基", asOf: "2026-01-01" },
        }),
        muni({ code: "01202", pref: "hokkaido" }), // ageStats なし
      ]);
      expect(r[0].covered).toBe(1);
      expect(r[0].total).toBe(2);
    });

    it("政令市の行政区は二重計上しない（muniLevelOnly と同じ扱い）", () => {
      const r = buildPrefRankingRows(aging, [
        muni({
          code: "01100", pref: "hokkaido", name: "札幌市",
          ageStats: { young: 10, elderly: 200, total: 1000, source: "住基", asOf: "2026-01-01" },
        }),
        muni({
          code: "01101", pref: "hokkaido", name: "中央区", level: "ward", parentCode: "01100",
          ageStats: { young: 10, elderly: 900, total: 1000, source: "住基", asOf: "2026-01-01" },
        }),
      ]);
      expect(r).toHaveLength(1);
      expect(r[0].value).toBeCloseTo(20, 6); // 区が混ざれば 55% になる
      expect(r[0].total).toBe(1);
    });
  });

  // counts と aggregate が対象判定を二重に持つと「県の合計」と「カバレッジ」が
  // 静かにずれる。絞り込みは buildPrefRankingRows の1箇所だけで行う契約を固定する。
  describe("対象判定の単一ソース", () => {
    it("すべての定義で、counts が false の自治体だけの県は行に出ない", () => {
      // 人口0・各指標のデータなし＝6定義すべてで対象外になる自治体
      const blank = muni({ code: "01203", pref: "hokkaido", population: 0 });
      for (const def of PREF_RANKINGS) {
        expect(def.counts(blank), `${def.slug}: counts`).toBe(false);
        expect(buildPrefRankingRows(def, [blank]), `${def.slug}: rows`).toEqual([]);
      }
    });

    it("covered は合算に実際に使った件数（counts を通った数）と一致する", () => {
      const aging = getPrefRankingBySlug("aging-high")!;
      const withData = muni({
        code: "01201", pref: "hokkaido",
        ageStats: { young: 10, elderly: 300, total: 1000, source: "住基", asOf: "2026-01-01" },
      });
      const list = [withData, muni({ code: "01202", pref: "hokkaido" }), muni({ code: "01203", pref: "hokkaido" })];
      const rows = buildPrefRankingRows(aging, list);
      expect(rows[0].covered).toBe(list.filter(aging.counts).length);
    });
  });
});

// 外国人住民比率の県値は lib/foreignStats.ts でも（比較ページの県平均として）計算されて
// いる。同じ公表数値の実装が2つある以上、片方だけ変わって静かにずれないよう実データで縛る。
describe("外国人住民比率の県値は foreignStats の県平均と一致する", () => {
  it("全47都道府県で一致する", async () => {
    const [{ listAllAcrossPrefs }, { getForeignStats, prefForeignAvgs }] = await Promise.all([
      import("@/lib/metrics"),
      import("@/lib/foreignStats"),
    ]);
    const def = getPrefRankingBySlug("foreign-ratio-high")!;
    const rows = buildPrefRankingRows(def, await listAllAcrossPrefs());
    const avgs = prefForeignAvgs(await getForeignStats());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const expected = avgs.get(r.prefSlug);
      expect(expected, r.prefSlug).toBeDefined();
      expect(r.value, r.prefSlug).toBeCloseTo(expected!, 9);
    }
  });
});
