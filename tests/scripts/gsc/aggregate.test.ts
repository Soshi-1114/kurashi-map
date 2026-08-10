import { describe, it, expect } from "vitest";
import {
  aggregateMunicipalities,
  aggregatePageTypes,
  aggregatePrefectures,
  aggregateQueryCategories,
  buildDailySeries,
  classifyMuniStatus,
  groupByKey,
  metricsFromDailyPoints,
  metricsFromRow,
  totalMetrics,
} from "../../../scripts/gsc/aggregate";
import type { GscApiRow, MuniMeta } from "../../../scripts/gsc/types";

function row(keys: string[], clicks: number, impressions: number, position: number): GscApiRow {
  return { keys, clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position };
}

describe("totalMetrics / groupByKey", () => {
  it("clicks/impressions は合計、position は impressions 加重平均、ctr は再計算する", () => {
    const rows = [row(["a"], 10, 100, 5), row(["a"], 0, 100, 15)];
    const total = totalMetrics(rows);
    expect(total.clicks).toBe(10);
    expect(total.impressions).toBe(200);
    expect(total.ctr).toBeCloseTo(0.05);
    expect(total.position).toBeCloseTo(10); // (5*100 + 15*100) / 200
  });

  it("groupByKey は最初のキーでグルーピングする", () => {
    const rows = [row(["/a"], 5, 50, 3), row(["/a"], 5, 50, 7), row(["/b"], 1, 10, 20)];
    const grouped = groupByKey(rows, (r) => r.keys[0]);
    expect(grouped.get("/a")?.clicks).toBe(10);
    expect(grouped.get("/a")?.position).toBeCloseTo(5);
    expect(grouped.get("/b")?.clicks).toBe(1);
  });
});

describe("metricsFromRow", () => {
  it("1行をそのまま Metrics に変換する", () => {
    const m = metricsFromRow(row(["/a", "q"], 3, 30, 8));
    expect(m).toEqual({ clicks: 3, impressions: 30, ctr: 0.1, position: 8 });
  });
});

describe("buildDailySeries", () => {
  it("日付順にソートし、7日移動平均を計算する", () => {
    const rows = [
      row(["2026-01-03"], 3, 30, 10),
      row(["2026-01-01"], 1, 10, 10),
      row(["2026-01-02"], 2, 20, 10),
    ];
    const series = buildDailySeries(rows);
    expect(series.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    // 3点しかないので window はそれぞれ 1,2,3点の平均
    expect(series[0].clicksMA7).toBeCloseTo(1);
    expect(series[1].clicksMA7).toBeCloseTo(1.5);
    expect(series[2].clicksMA7).toBeCloseTo(2);
  });
});

describe("metricsFromDailyPoints", () => {
  it("複数日を合算し position は加重平均する", () => {
    const series = buildDailySeries([row(["2026-01-01"], 1, 10, 5), row(["2026-01-02"], 1, 10, 15)]);
    const m = metricsFromDailyPoints(series);
    expect(m.clicks).toBe(2);
    expect(m.impressions).toBe(20);
    expect(m.position).toBeCloseTo(10);
  });
});

describe("classifyMuniStatus", () => {
  const t = {
    weakMaxImpressions: 5,
    opportunityMinPosition: 11,
    opportunityMaxPosition: 20,
    lowCtrMaxPosition: 10,
    lowCtrMaxCtr: 0.02,
    lowCtrMinImpressions: 20,
    growingMinClicksDeltaPct: 0.2,
    growingMinPositionImprove: 2,
    strongMinClicks: 5,
  };

  it("impressions=0 は noImpression", () => {
    expect(classifyMuniStatus({ clicks: 0, impressions: 0, ctr: 0, position: 0 }, null, t)).toBe("noImpression");
  });

  it("impressions が閾値未満は weak", () => {
    expect(classifyMuniStatus({ clicks: 0, impressions: 3, ctr: 0, position: 30 }, null, t)).toBe("weak");
  });

  it("11〜20位は opportunity", () => {
    expect(classifyMuniStatus({ clicks: 1, impressions: 50, ctr: 0.02, position: 15 }, null, t)).toBe("opportunity");
  });

  it("上位だが低CTRは lowCtr", () => {
    expect(classifyMuniStatus({ clicks: 1, impressions: 100, ctr: 0.01, position: 5 }, null, t)).toBe("lowCtr");
  });

  it("前期間よりクリックが大きく伸びていれば growing", () => {
    const current = { clicks: 20, impressions: 500, ctr: 0.04, position: 5 };
    const prev = { clicks: 10, impressions: 500, ctr: 0.02, position: 5 };
    expect(classifyMuniStatus(current, prev, t)).toBe("growing");
  });

  it("十分なクリックがあれば strong", () => {
    expect(classifyMuniStatus({ clicks: 10, impressions: 500, ctr: 0.05, position: 5 }, null, t)).toBe("strong");
  });

  it("どれにも該当しなければ other", () => {
    expect(classifyMuniStatus({ clicks: 1, impressions: 200, ctr: 0.03, position: 5 }, null, t)).toBe("other");
  });
});

function muniMaster(): Map<string, MuniMeta> {
  const m = new Map<string, MuniMeta>();
  m.set("11203", { code: "11203", prefSlug: "saitama", prefNameJa: "埼玉県", name: "川口市", displayName: "川口市", url: "/area/saitama/11203" });
  m.set("11100", { code: "11100", prefSlug: "saitama", prefNameJa: "埼玉県", name: "さいたま市", displayName: "さいたま市", url: "/area/saitama/11100" });
  return m;
}

describe("aggregateMunicipalities", () => {
  it("GSC に出てこない自治体も0行として出力し coverage を算出する", () => {
    const pageMetrics = new Map([["/area/saitama/11203", { clicks: 5, impressions: 100, ctr: 0.05, position: 8 }]]);
    const { rows, coverage } = aggregateMunicipalities(pageMetrics, [], muniMaster(), null);
    expect(rows).toHaveLength(2);
    expect(coverage).toEqual({ total: 2, exposed: 1, noImpression: 1, exposureRate: 0.5 });
    const kawaguchi = rows.find((r) => r.code === "11203");
    expect(kawaguchi?.status).not.toBe("noImpression");
    const saitama = rows.find((r) => r.code === "11100");
    expect(saitama?.status).toBe("noImpression");
  });

  it("page×query 行から queryCount を集計する", () => {
    const pageMetrics = new Map([["/area/saitama/11203", { clicks: 5, impressions: 100, ctr: 0.05, position: 8 }]]);
    const pageQueryRows = [row(["/area/saitama/11203", "川口市 住みやすさ"], 3, 50, 6), row(["/area/saitama/11203", "川口市 家賃"], 2, 50, 10)];
    const { rows } = aggregateMunicipalities(pageMetrics, pageQueryRows, muniMaster(), null);
    expect(rows.find((r) => r.code === "11203")?.queryCount).toBe(2);
  });
});

describe("aggregatePrefectures", () => {
  it("自治体行を都道府県ごとに合算し exposureRate を算出する", () => {
    const pageMetrics = new Map([["/area/saitama/11203", { clicks: 5, impressions: 100, ctr: 0.05, position: 8 }]]);
    const { rows: muniRows } = aggregateMunicipalities(pageMetrics, [], muniMaster(), null);
    const prefs = aggregatePrefectures(muniRows);
    expect(prefs).toHaveLength(1);
    expect(prefs[0]).toMatchObject({ prefSlug: "saitama", municipalityCount: 2, exposedCount: 1, clicks: 5 });
  });
});

describe("aggregatePageTypes / aggregateQueryCategories", () => {
  it("pageType ごとに集計しページ数を数える", () => {
    const rows = [row(["/"], 1, 10, 3), row(["/area/saitama"], 2, 20, 5)];
    const classify = (url: string) =>
      url === "/" ? { url, path: url, pageType: "top" as const } : { url, path: url, pageType: "prefecture" as const };
    const agg = aggregatePageTypes(rows, classify);
    expect(agg.find((a) => a.pageType === "top")?.pageCount).toBe(1);
    expect(agg.find((a) => a.pageType === "prefecture")?.clicks).toBe(2);
  });

  it("クエリカテゴリごとに集計しクエリ数を数える", () => {
    const rows = [row(["家賃相場"], 3, 30, 4), row(["家賃 高い"], 1, 10, 8)];
    const agg = aggregateQueryCategories(rows, () => "money");
    expect(agg[0]).toMatchObject({ category: "money", queryCount: 2, clicks: 4 });
  });
});
