// GSC 分析ツールの CLI エントリポイント。
//
//   npm run gsc:analyze -- --days 28
//   npm run gsc:analyze -- --days 90
//   npm run gsc:analyze -- --days 28 --compare
//   npm run gsc:analyze -- --days 28 --compare=yoy
//
// フロー: fetch（GSC API） → classify（URL/クエリ） → aggregate（集計） →
//         opportunities（抽出） → report（CSV / summary.md / analysis.json / analysis-prompt.md）
//
// 認証情報が無い環境でもエラーメッセージで「何を設定すればよいか」が分かるようにする
// （auth.ts 参照）。

import fs from "node:fs";
import path from "node:path";
import { fetchAllRows } from "./api";
import {
  aggregateMunicipalities,
  aggregatePageTypes,
  aggregatePrefectures,
  aggregateQueryCategories,
  buildDailySeries,
  groupByKey,
  metricsFromDailyPoints,
  totalMetrics,
  type DailyPoint,
} from "./aggregate";
import { DEFAULT_DAYS, END_DATE_LAG_DAYS, GSC_SITE_URL, REPORT_OUT_DIR, REPORT_TOP_N } from "./config";
import { writeAllCsvs } from "./report/csvExports";
import {
  comparePages,
  findHighImpressionLowCtr,
  findNearTop,
  findNewVisibility,
  findPage2,
  findPositionDecline,
  findPositionImprove,
  findZeroClickHighImpression,
  topLosers,
  topWinners,
} from "./opportunities";
import { buildAnalysisJson } from "./report/analysisJson";
import { buildAnalysisPrompt } from "./report/analysisPrompt";
import { buildPageQueryRows, buildPageRows, buildQueryRows } from "./report/rows";
import { buildSummaryMarkdown } from "./report/summary";
import type { CompareBundle, FixedWindowComparison, ReportBundle } from "./report/types";
import type { GscApiRow, PeriodRange } from "./types";
import { buildMuniNameMatcher, classifyQuery, normalizeQuery } from "./queryMeta";
import { classifyUrl, fetchPageRows, loadMuniMaster, type PageRowsFetch } from "./urlMeta";

// ===== 引数パース =====

function readArg(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && argv[idx + 1] !== undefined && !argv[idx + 1].startsWith("--")) return argv[idx + 1];
  return undefined;
}
function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`) || argv.some((a) => a.startsWith(`--${name}=`));
}

interface Cli {
  days: number;
  compareMode: "none" | "adjacent" | "yoy";
  siteUrl: string;
  outDir: string;
}

function parseArgs(argv: string[]): Cli {
  const daysArg = readArg(argv, "days") ?? String(DEFAULT_DAYS);
  const days = Number(daysArg);
  if (!Number.isFinite(days) || days <= 0 || !Number.isInteger(days)) {
    throw new Error(`--days は正の整数で指定してください（例: 7 / 28 / 90）。受け取った値: "${daysArg}"`);
  }
  const compareMode: Cli["compareMode"] = !hasFlag(argv, "compare") ? "none" : readArg(argv, "compare") === "yoy" ? "yoy" : "adjacent";
  const siteUrl = readArg(argv, "site-url") ?? GSC_SITE_URL;
  const outDir = readArg(argv, "out") ?? REPORT_OUT_DIR;
  return { days, compareMode, siteUrl, outDir };
}

// ===== 日付ユーティリティ =====

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return toISODate(d);
}

// ===== メイン =====

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const today = toISODate(new Date());

  // GSC はデータ確定までラグがあるため、直近 END_DATE_LAG_DAYS 日は除外する。
  const endDate = addDays(today, -END_DATE_LAG_DAYS);
  const startDate = addDays(endDate, -(cli.days - 1));
  const current: PeriodRange = { startDate, endDate, label: `直近${cli.days}日` };

  let previous: PeriodRange | null = null;
  if (cli.compareMode === "adjacent") {
    const prevEnd = addDays(startDate, -1);
    const prevStart = addDays(prevEnd, -(cli.days - 1));
    previous = { startDate: prevStart, endDate: prevEnd, label: `前${cli.days}日` };
  } else if (cli.compareMode === "yoy") {
    previous = { startDate: addDays(startDate, -365), endDate: addDays(endDate, -365), label: "前年同期" };
  }

  // 日別サイト全体トレンド + 直近7日/28日の固定比較は、--days の指定に関わらず常に
  // 直近90日分から算出する（仕様10. の最低要件を常に満たすため）。
  const dailyRange: PeriodRange = { startDate: addDays(endDate, -89), endDate, label: "直近90日" };

  console.log(`[gsc] site=${cli.siteUrl} period=${current.startDate}〜${current.endDate} compare=${cli.compareMode}`);

  // 各 dimensions の取得はそれぞれ独立しているため、まとめて並行実行する
  // （GSC API 側の 429/5xx リトライは api.ts の fetchAllRows が個別に処理する）。
  console.log(`[gsc] fetching ${previous ? 7 : 6} datasets from GSC ...`);
  const [dailyRowsRaw, pageCurrent, queryRowsCurrent, pageQueryCurrent, deviceRowsCurrent, countryRowsCurrent, pagePrev] =
    await Promise.all([
      fetchAllRows({ siteUrl: cli.siteUrl, ...dailyRange, dimensions: ["date"] }),
      fetchPageRows({ siteUrl: cli.siteUrl, ...current, dimensions: ["page"] }),
      fetchAllRows({ siteUrl: cli.siteUrl, ...current, dimensions: ["query"] }),
      fetchPageRows({ siteUrl: cli.siteUrl, ...current, dimensions: ["page", "query"] }),
      fetchAllRows({ siteUrl: cli.siteUrl, ...current, dimensions: ["device"] }),
      fetchAllRows({ siteUrl: cli.siteUrl, ...current, dimensions: ["country"] }),
      previous
        ? fetchPageRows({ siteUrl: cli.siteUrl, ...previous, dimensions: ["page"] })
        : Promise.resolve<PageRowsFetch | null>(null),
    ]);
  console.log("[gsc] fetch done.");

  // GSC は page キーにフル URL を返すが、自治体マスタ等はパスのみで管理しているため
  // 突き合わせ用に正規化する（raw/ には正規化前の生レスポンスを残す。fetchPageRows が両方返す）。
  const pageRowsCurrentRaw = pageCurrent.raw;
  const pageRowsCurrent = pageCurrent.normalized;
  const pageQueryRowsCurrentRaw = pageQueryCurrent.raw;
  const pageQueryRowsCurrent = pageQueryCurrent.normalized;
  const pageRowsPrevRaw: GscApiRow[] = pagePrev?.raw ?? [];
  const pageRowsPrev: GscApiRow[] = pagePrev?.normalized ?? [];

  // ===== 分類 =====
  const muniMaster = loadMuniMaster();
  const matchMuniName = buildMuniNameMatcher(muniMaster);
  const classifyUrlFn = (url: string) => classifyUrl(url, muniMaster);
  const classifyQueryFn = (q: string) => classifyQuery(normalizeQuery(q), matchMuniName);

  // ===== 集計 =====
  const dailyPoints = buildDailySeries(dailyRowsRaw);
  const fixedWindows = buildFixedWindows(dailyPoints, dailyRange);

  const pageMetricsCurrent = groupByKey(pageRowsCurrent, (r) => r.keys[0]);
  const queryMetricsCurrent = groupByKey(queryRowsCurrent, (r) => r.keys[0]);
  const siteCurrent = totalMetrics(pageRowsCurrent);

  const pageMetricsPrev = previous ? groupByKey(pageRowsPrev, (r) => r.keys[0]) : null;

  const pageTypes = aggregatePageTypes(pageRowsCurrent, classifyUrlFn);
  const queryCategories = aggregateQueryCategories(queryRowsCurrent, classifyQueryFn);
  const { rows: municipalities, coverage: muniCoverage } = aggregateMunicipalities(
    pageMetricsCurrent,
    pageQueryRowsCurrent,
    muniMaster,
    pageMetricsPrev,
  );
  const prefectures = aggregatePrefectures(municipalities);
  const devices = groupByKey(deviceRowsCurrent, (r) => r.keys[0]);
  const countries = groupByKey(countryRowsCurrent, (r) => r.keys[0]);

  const opportunities = {
    highImpressionLowCtr: findHighImpressionLowCtr(pageMetricsCurrent, classifyUrlFn),
    page2: findPage2(pageMetricsCurrent, classifyUrlFn),
    nearTop: findNearTop(pageMetricsCurrent, classifyUrlFn),
    zeroClickHighImpression: findZeroClickHighImpression(pageMetricsCurrent, classifyUrlFn),
  };

  let compare: CompareBundle | null = null;
  if (previous && pageMetricsPrev) {
    const diffRows = comparePages(pageMetricsCurrent, pageMetricsPrev, classifyUrlFn);
    compare = {
      mode: cli.compareMode === "yoy" ? "yoy" : "adjacent",
      period: previous,
      site: totalMetrics(pageRowsPrev),
      pageDiffs: diffRows,
      winners: topWinners(diffRows, REPORT_TOP_N.winners),
      losers: topLosers(diffRows, REPORT_TOP_N.losers),
      positionImprove: findPositionImprove(diffRows),
      positionDecline: findPositionDecline(diffRows),
      newVisibility: findNewVisibility(diffRows),
    };
  }

  const pages = buildPageRows(pageMetricsCurrent, classifyUrlFn);
  const queries = buildQueryRows(queryMetricsCurrent, classifyQueryFn);
  const pageQueries = buildPageQueryRows(pageQueryRowsCurrent, classifyUrlFn, classifyQueryFn);

  const noImpressionMunicipalities = municipalities.filter((m) => m.status === "noImpression");

  const dataNotes = [
    "GSC Search Analytics API は 1 サイトあたりの返却上限・上位データ中心の抽出・低頻度クエリの匿名化があるため、完全な全件取得を保証できません（rowLimit=25,000 でページングし取得できた範囲を集計）。",
    `直近 ${END_DATE_LAG_DAYS} 日はデータ未確定のため集計対象から除外しています。`,
    "SEO Opportunities（highImpressionLowCtr / page2 / nearTop / zeroClickHighImpression）はページ単位（page dimension）の集計値で判定しています。クエリ単位の内訳は page-query.csv を参照してください。",
    "期間比較（Winners/Losers/新規露出・順位変動）はページ単位のみで、クエリ単位の期間比較は行っていません。",
    cli.compareMode === "yoy" ? "前年同期比較（--compare=yoy）はサイト全体・ページ単位の比較のみを対象とし、日別トレンド（直近90日）は前年分を含みません。" : null,
  ].filter((n): n is string => Boolean(n));

  const bundle: ReportBundle = {
    generatedAt,
    siteUrl: cli.siteUrl,
    searchType: "web",
    current,
    compare,
    daily: dailyPoints,
    dailyRange,
    fixedWindows,
    site: siteCurrent,
    pages,
    queries,
    pageQueries,
    pageTypes,
    queryCategories,
    municipalities,
    muniCoverage,
    prefectures,
    devices,
    countries,
    opportunities,
    noImpressionMunicipalities,
    dataNotes,
  };

  // ===== 出力 =====
  const outDir = path.join(cli.outDir, today);
  const rawDir = path.join(outDir, "raw");
  fs.mkdirSync(rawDir, { recursive: true });

  writeAllCsvs(outDir, bundle);

  const rawDumps: Record<string, GscApiRow[]> = {
    "site-date.json": dailyRowsRaw,
    "pages.json": pageRowsCurrentRaw,
    "queries.json": queryRowsCurrent,
    "page-query.json": pageQueryRowsCurrentRaw,
    "device.json": deviceRowsCurrent,
    "country.json": countryRowsCurrent,
  };
  for (const [name, rows] of Object.entries(rawDumps)) {
    fs.writeFileSync(path.join(rawDir, name), JSON.stringify(rows, null, 2), "utf-8");
  }
  if (previous) {
    fs.writeFileSync(path.join(rawDir, "pages-previous.json"), JSON.stringify(pageRowsPrevRaw, null, 2), "utf-8");
  }

  fs.writeFileSync(path.join(outDir, "summary.md"), buildSummaryMarkdown(bundle), "utf-8");
  fs.writeFileSync(path.join(outDir, "analysis.json"), JSON.stringify(buildAnalysisJson(bundle), null, 2), "utf-8");
  fs.writeFileSync(path.join(outDir, "analysis-prompt.md"), buildAnalysisPrompt(bundle), "utf-8");

  console.log(`[gsc] done. clicks=${siteCurrent.clicks} impressions=${siteCurrent.impressions} -> ${outDir}`);
}

function buildFixedWindows(
  points: DailyPoint[],
  dailyRange: PeriodRange,
): { last7: FixedWindowComparison; last28: FixedWindowComparison } {
  const slice = (daysBack: number, offset: number): DailyPoint[] => {
    const end = points.length - offset;
    const start = end - daysBack;
    return points.slice(Math.max(0, start), Math.max(0, end));
  };
  const rangeOf = (slicePoints: DailyPoint[]): PeriodRange => ({
    startDate: slicePoints[0]?.date ?? dailyRange.startDate,
    endDate: slicePoints[slicePoints.length - 1]?.date ?? dailyRange.endDate,
    label: "",
  });
  const build = (label: string, days: number): FixedWindowComparison => {
    const curSlice = slice(days, 0);
    const prevSlice = slice(days, days);
    return {
      label,
      current: metricsFromDailyPoints(curSlice),
      previous: metricsFromDailyPoints(prevSlice),
      currentRange: rangeOf(curSlice),
      previousRange: rangeOf(prevSlice),
    };
  };
  return { last7: build("直近7日", 7), last28: build("直近28日", 28) };
}

main().catch((e) => {
  console.error(`[gsc] 失敗: ${e instanceof Error ? e.message : String(e)}`);
  if (e instanceof Error && e.stack) console.error(e.stack);
  process.exit(1);
});
