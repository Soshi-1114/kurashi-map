// summary.md 生成。仕様14. の見出し構成をそのまま章立てにする。数値は format.ts の
// round/pctText で丸め、表は Markdown テーブルとして出す（人間にも AI にも読みやすい形式）。

import { REPORT_TOP_N } from "../config";
import { pctText, positionText, round } from "../format";
import type { Metrics } from "../types";
import type { FixedWindowComparison, ReportBundle } from "./types";

function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "_該当データなし_\n";
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n`;
}

/** 増減の符号付き整数。0 は "±0"。 */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? String(n) : "±0";
}
/** 比率の差をパーセントポイントで。例: 0.012 → "+1.20pt"。 */
function signedPctPoints(ratioDelta: number): string {
  const pts = round(ratioDelta * 100, 2);
  return pts > 0 ? `+${pts}pt` : pts < 0 ? `${pts}pt` : "±0pt";
}
/** 掲載順位の差。正=改善。 */
function signedPosition(delta: number): string {
  const d = round(delta, 1);
  return d > 0 ? `+${d}` : d < 0 ? String(d) : "±0";
}

function metricsCells(m: Metrics): string[] {
  return [String(m.clicks), String(m.impressions), pctText(m.ctr), positionText(m.position)];
}

function fixedWindowSection(title: string, w: FixedWindowComparison): string {
  const clicksDelta = w.previous.clicks === 0 ? "-" : `${round(((w.current.clicks - w.previous.clicks) / w.previous.clicks) * 100, 1)}%`;
  const impDelta =
    w.previous.impressions === 0 ? "-" : `${round(((w.current.impressions - w.previous.impressions) / w.previous.impressions) * 100, 1)}%`;
  return (
    `### ${title}\n\n` +
    mdTable(
      ["区分", "期間", "clicks", "impressions", "CTR", "平均掲載順位"],
      [
        [w.label, `${w.currentRange.startDate} 〜 ${w.currentRange.endDate}`, ...metricsCells(w.current)],
        [`前${title.replace(/[^0-9]/g, "")}日`, `${w.previousRange.startDate} 〜 ${w.previousRange.endDate}`, ...metricsCells(w.previous)],
      ],
    ) +
    `\nclicks 増減率: ${clicksDelta} / impressions 増減率: ${impDelta}\n`
  );
}

export function buildSummaryMarkdown(b: ReportBundle): string {
  const parts: string[] = [];

  parts.push("# KurashiMap GSC Report\n");

  parts.push("## Period\n");
  parts.push(
    `対象期間: **${b.current.label}**（${b.current.startDate} 〜 ${b.current.endDate}）\n` +
      (b.compare
        ? `比較期間（${b.compare.mode === "yoy" ? "前年同期" : "直前期間"}）: ${b.compare.period.startDate} 〜 ${b.compare.period.endDate}\n`
        : "期間比較: なし（--compare で有効化）\n"),
  );

  const exposureRate = pctText(b.muniCoverage.exposureRate);
  const topCategory = b.queryCategories[0];
  const topPageType = b.pageTypes.find((p) => p.pageType === "municipality");

  parts.push("## Executive Summary\n");
  parts.push(
    [
      `- サイト全体: clicks **${b.site.clicks}** / impressions **${b.site.impressions}** / CTR **${pctText(b.site.ctr)}** / 平均掲載順位 **${positionText(b.site.position)}**（${b.current.label}）`,
      `- 自治体詳細ページ（全${b.muniCoverage.total}件）のうち GSC 露出あり: **${b.muniCoverage.exposed}件**（${exposureRate}）、露出なし: **${b.muniCoverage.noImpression}件**`,
      topPageType
        ? `- 自治体詳細ページ群の合計: clicks ${topPageType.clicks} / impressions ${topPageType.impressions}（サイト全体の impressions の ${b.site.impressions > 0 ? pctText(topPageType.impressions / b.site.impressions) : "-"}）`
        : null,
      topCategory ? `- 最大流入クエリカテゴリ: **${topCategory.category}**（clicks ${topCategory.clicks} / query数 ${topCategory.queryCount}）` : null,
      b.compare
        ? `- 期間比較: clicks ${b.site.clicks - b.compare.site.clicks >= 0 ? "+" : ""}${b.site.clicks - b.compare.site.clicks} / impressions ${b.site.impressions - b.compare.site.impressions >= 0 ? "+" : ""}${b.site.impressions - b.compare.site.impressions}`
        : null,
    ]
      .filter(Boolean)
      .join("\n") + "\n",
  );

  parts.push("## Site Performance\n");
  parts.push(mdTable(["指標", "値"], [
    ["clicks", String(b.site.clicks)],
    ["impressions", String(b.site.impressions)],
    ["CTR", pctText(b.site.ctr)],
    ["平均掲載順位", positionText(b.site.position)],
  ]));
  parts.push("\n**デバイス別**\n\n");
  parts.push(
    mdTable(
      ["device", "clicks", "impressions", "CTR", "平均掲載順位"],
      [...b.devices.entries()].sort((a, c) => c[1].clicks - a[1].clicks).map(([d, m]) => [d, ...metricsCells(m)]),
    ),
  );
  parts.push("\n**国別（上位10）**\n\n");
  parts.push(
    mdTable(
      ["country", "clicks", "impressions", "CTR", "平均掲載順位"],
      [...b.countries.entries()]
        .sort((a, c) => c[1].clicks - a[1].clicks)
        .slice(0, 10)
        .map(([cty, m]) => [cty, ...metricsCells(m)]),
    ),
  );

  if (b.compare) {
    parts.push("\n## Period Comparison\n");
    if (b.compare.warning) parts.push(`> ⚠️ ${b.compare.warning}\n`);
    parts.push(
      mdTable(
        ["期間", "clicks", "impressions", "CTR", "平均掲載順位"],
        [
          [`${b.current.label}（${b.current.startDate}〜${b.current.endDate}）`, ...metricsCells(b.site)],
          [
            `${b.compare.period.label}（${b.compare.period.startDate}〜${b.compare.period.endDate}）`,
            ...metricsCells(b.compare.site),
          ],
        ],
      ),
    );

    parts.push("\n### ページタイプ別の増減\n\n");
    parts.push(
      mdTable(
        ["pageType", "clicks", "Δclicks", "impressions", "Δimpressions", "CTR", "ΔCTR", "平均掲載順位", "Δ順位"],
        b.compare.pageTypes.map((d) => [
          d.pageType,
          String(d.current.clicks),
          signed(d.clicksDelta),
          String(d.current.impressions),
          signed(d.impressionsDelta),
          pctText(d.current.ctr),
          signedPctPoints(d.ctrDelta),
          positionText(d.current.position),
          signedPosition(d.positionDelta),
        ]),
      ),
    );
    parts.push("\n※ Δ順位は正の値が改善（掲載順位の数値が小さくなった）。\n");

    const cov = b.compare.coverage;
    parts.push("\n### 自治体ページの露出率（Exposure Rate）\n\n");
    parts.push(
      mdTable(
        ["期間", "露出あり", "全ページ", "露出率"],
        [
          [b.current.label, String(cov.exposed), String(cov.total), pctText(cov.exposureRate)],
          [b.compare.period.label, String(cov.prevExposed), String(cov.total), pctText(cov.prevExposureRate)],
        ],
      ),
    );
    parts.push(`\n増減: ${signed(cov.exposed - cov.prevExposed)}ページ（${signedPctPoints(cov.rateDelta)}）\n`);

    if (b.compare.urlSets.length > 0) {
      parts.push("\n### 施策URLセットの効果\n\n");
      parts.push(
        "`docs/seo/url-sets.json` で定義した施策対象URL群ごとの前後比較。**本番反映日より前の期間と比べていない場合、この表は施策の効果を示さない**（期間の指定は `--since` を参照）。\n\n",
      );
      parts.push(
        mdTable(
          ["セット", "PR", "対象ページ数", "clicks", "Δclicks", "impressions", "Δimpressions", "CTR", "ΔCTR", "平均掲載順位", "Δ順位"],
          b.compare.urlSets.map((s) => [
            s.name,
            s.pr ? `#${s.pr}` : "-",
            `${s.matchedPages}（前 ${s.prevMatchedPages}）`,
            String(s.current.clicks),
            signed(s.clicksDelta),
            String(s.current.impressions),
            signed(s.impressionsDelta),
            pctText(s.current.ctr),
            signedPctPoints(s.ctrDelta),
            positionText(s.current.position),
            signedPosition(s.positionDelta),
          ]),
        ),
      );
      for (const s of b.compare.urlSets) {
        if (s.note) parts.push(`\n- **${s.name}**: ${s.note}`);
      }
      parts.push("\n");
    }
  }

  parts.push("\n" + fixedWindowSection("直近7日", b.fixedWindows.last7));
  parts.push("\n" + fixedWindowSection("直近28日", b.fixedWindows.last28));

  parts.push("\n## Page Type Performance\n");
  parts.push(
    mdTable(
      ["pageType", "pages", "clicks", "impressions", "CTR", "平均掲載順位"],
      b.pageTypes.map((p) => [p.pageType, String(p.pageCount), ...metricsCells(p)]),
    ),
  );

  const topMuni = b.municipalities.filter((m) => m.impressions > 0).slice(0, REPORT_TOP_N.summaryDisplay);
  parts.push("\n## Municipality Performance\n");
  parts.push(
    `自治体詳細ページ ${b.muniCoverage.total} 件中、GSC 露出あり ${b.muniCoverage.exposed} 件（${exposureRate}）。上位30件:\n\n`,
  );
  parts.push(
    mdTable(
      ["自治体", "都道府県", "clicks", "impressions", "CTR", "平均掲載順位", "queryCount", "status"],
      topMuni.map((m) => [m.name, m.prefNameJa, ...metricsCells(m), String(m.queryCount), m.status]),
    ),
  );

  parts.push("\n## Prefecture Performance\n");
  parts.push(
    mdTable(
      ["都道府県", "municipalities", "exposed", "exposureRate", "clicks", "impressions", "CTR", "平均掲載順位"],
      b.prefectures.map((p) => [
        p.prefNameJa,
        String(p.municipalityCount),
        String(p.exposedCount),
        pctText(p.exposureRate),
        ...metricsCells(p),
      ]),
    ),
  );

  parts.push("\n## Query Categories\n");
  parts.push(
    mdTable(
      ["category", "queries", "clicks", "impressions", "CTR", "平均掲載順位"],
      b.queryCategories.map((q) => [q.category, String(q.queryCount), ...metricsCells(q)]),
    ),
  );

  parts.push("\n## SEO Opportunities\n");

  parts.push("\n### Winners\n\n");
  parts.push(
    b.compare
      ? mdTable(
          ["url", "muni/pref", "clicks", "prevClicks", "Δclicks", "impressions", "position"],
          b.compare.winners
            .slice(0, REPORT_TOP_N.summaryDisplay)
            .map((r) => [r.url, r.muniName ?? r.prefNameJa ?? "-", String(r.clicks), String(r.prevClicks), `+${r.clicksDelta}`, String(r.impressions), positionText(r.position)]),
        )
      : "_--compare 未指定のため算出なし_\n",
  );

  parts.push("\n### Losers\n\n");
  parts.push(
    b.compare
      ? mdTable(
          ["url", "muni/pref", "clicks", "prevClicks", "Δclicks", "impressions", "position"],
          b.compare.losers
            .slice(0, REPORT_TOP_N.summaryDisplay)
            .map((r) => [r.url, r.muniName ?? r.prefNameJa ?? "-", String(r.clicks), String(r.prevClicks), String(r.clicksDelta), String(r.impressions), positionText(r.position)]),
        )
      : "_--compare 未指定のため算出なし_\n",
  );

  parts.push("\n### New Search Visibility\n\n");
  parts.push(
    b.compare
      ? mdTable(
          ["url", "muni/pref", "impressions", "clicks", "position"],
          b.compare.newVisibility.slice(0, REPORT_TOP_N.summaryDisplay).map((r) => [r.url, r.muniName ?? r.prefNameJa ?? "-", String(r.impressions), String(r.clicks), positionText(r.position)]),
        )
      : "_--compare 未指定のため算出なし_\n",
  );

  parts.push("\n### Low CTR Opportunities\n\n");
  parts.push(
    mdTable(
      ["url", "muni/pref", "impressions", "clicks", "CTR", "position"],
      b.opportunities.highImpressionLowCtr
        .slice(0, REPORT_TOP_N.summaryDisplay)
        .map((r) => [r.url, r.muniName ?? r.prefNameJa ?? "-", String(r.impressions), String(r.clicks), pctText(r.ctr), positionText(r.position)]),
    ),
  );

  parts.push("\n### Position 8-20 Opportunities\n\n");
  parts.push(
    mdTable(
      ["url", "muni/pref", "impressions", "clicks", "CTR", "position"],
      b.opportunities.page2
        .slice(0, REPORT_TOP_N.summaryDisplay)
        .map((r) => [r.url, r.muniName ?? r.prefNameJa ?? "-", String(r.impressions), String(r.clicks), pctText(r.ctr), positionText(r.position)]),
    ),
  );

  parts.push("\n### Pages Without Search Impressions\n\n");
  parts.push(
    `自治体詳細ページで GSC に impressions が一度も記録されていないもの: **${b.noImpressionMunicipalities.length}件**（上位30件を表示。全件は no-impression-pages.csv）\n\n`,
  );
  parts.push(
    mdTable(
      ["自治体", "都道府県", "url"],
      b.noImpressionMunicipalities.slice(0, REPORT_TOP_N.summaryDisplay).map((m) => [m.name, m.prefNameJa, m.url]),
    ),
  );

  parts.push("\n## Recommended Investigation Targets\n\n");
  const targets: string[] = [];
  if (b.opportunities.highImpressionLowCtr.length > 0) {
    targets.push(`title/description 改善候補が ${b.opportunities.highImpressionLowCtr.length} 件（高表示・低CTR）`);
  }
  if (b.opportunities.page2.length > 0) {
    targets.push(`コンテンツ・内部リンク改善候補が ${b.opportunities.page2.length} 件（8〜20位。11〜15位を優先）`);
  }
  if (b.opportunities.nearTop.length > 0) {
    targets.push(`数順位の改善で流入増が見込めるページが ${b.opportunities.nearTop.length} 件（4〜10位）`);
  }
  if (b.muniCoverage.noImpression > 0) {
    targets.push(
      `自治体詳細ページの ${b.muniCoverage.noImpression} 件（${pctText(1 - b.muniCoverage.exposureRate)}）が GSC に未露出。内部リンク・独自性の強化候補`,
    );
  }
  if (b.compare && b.compare.positionDecline.length > 0) {
    targets.push(`順位急落ページが ${b.compare.positionDecline.length} 件。原因調査（コンテンツ変更・競合・アルゴリズム変動）を推奨`);
  }
  parts.push(targets.length > 0 ? targets.map((t) => `- ${t}`).join("\n") + "\n" : "_特筆すべき候補なし_\n");

  parts.push("\n## Data Notes\n\n");
  parts.push(
    [
      `- property: \`${b.siteUrl}\``,
      `- Search type: \`${b.searchType}\``,
      `- 取得期間: ${b.current.startDate} 〜 ${b.current.endDate}（データ確定の遅延を考慮し直近数日は除外）`,
      `- データ取得日時: ${b.generatedAt}`,
      "- filter: なし（全ページ・全クエリ）",
      ...b.dataNotes.map((n) => `- ${n}`),
    ].join("\n") + "\n",
  );

  return parts.join("\n");
}
