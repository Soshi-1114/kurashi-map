import { expectedCaptureKeys, records, ratio, STUDY, type RecordRow, type Snapshot } from "./model";
import { rankingCompareAttribution } from "../../lib/siteNav";
import { compareAttributionParams } from "../../lib/analytics";

const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const fmt = (v: unknown): string => numeric(v) === null ? "—" : Number(v).toLocaleString("ja-JP", { maximumFractionDigits: 2 });
const pct = (v: number | null): string => v === null ? "—" : `${(v * 100).toFixed(2)}%`;
const cell = (v: unknown): string => String(v ?? "—").replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
function table(headers: string[], rows: unknown[][]): string {
  return ["| " + headers.map(cell).join(" | ") + " |", "| " + headers.map(() => "---").join(" | ") + " |", ...rows.map(row => "| " + row.map(cell).join(" | ") + " |")].join("\n");
}
export function pageGroup(path: string): string {
  let p = path;
  try { p = new URL(path).pathname; } catch { /* GA4 pagePath */ }
  if (p.startsWith("/ranking/")) return "ランキング";
  if (p.startsWith("/area/") && p.split("/").length >= 4) return "自治体詳細";
  if (p === "/compare") return "比較";
  if (p === "/shindan") return "診断";
  if (p === "/denki") return "電気";
  if (p.startsWith("/map")) return "地図";
  return "その他";
}
export function sumGroups(rows: RecordRow[] | null, key: string, metric: string): Record<string, number> | null {
  if (rows === null) return null;
  const result: Record<string, number> = {};
  for (const row of rows) { const group = pageGroup(String(row[key])); result[group] = (result[group] ?? 0) + Number(row[metric]); }
  return result;
}
function event(rows: RecordRow[] | null, name: string, metric: "eventCount" | "totalUsers"): number | null {
  if (rows === null) return null;
  return numeric(rows.find(r => r.eventName === name)?.[metric] ?? 0);
}
export function studySummary(s: Snapshot, periodName = "study") {
  const variants = records(s.captures[periodName + ".ga.variants"]);
  const followup = periodName === "studyFollowup";
  const targetEnd = followup ? STUDY.extendedEnd : STUDY.end;
  const reviewAfter = followup ? STUDY.extendedReviewAfter : STUDY.reviewAfter;
  const definitions = [
    { tool: "電気", variant: "inline-v1", prefix: "denki" },
    { tool: "備蓄", variant: "water-inline-v1", prefix: "stockpile" },
  ];
  const rows = definitions.map(d => {
    const cohort = variants?.filter(r => r["customEvent:cta_variant"] === d.variant && r["customEvent:measurement_version"] === "2026-10-31") ?? null;
    const views = event(cohort, d.prefix + "_entry_view", "eventCount");
    const viewUsers = event(cohort, d.prefix + "_entry_view", "totalUsers");
    const resultUsers = event(cohort, d.prefix + "_quick_result_view", "totalUsers");
    const resultRate = ratio(resultUsers, viewUsers);
    const mature = !!s.plan.periods[periodName] && s.plan.periods[periodName].endDate >= targetEnd && s.plan.today >= reviewAfter;
    return { ...d, views, viewUsers, interactions: event(cohort, d.prefix + "_quick_interact", "totalUsers"), resultUsers, resultRate,
      state: !mature ? "中間集計・判断保留" : views === null || viewUsers === null || resultUsers === null || resultRate === null ? "取得不足・判断保留" : views < 500 ? (followup ? "28日終了・母数不足のため判断保留" : "500視認未満・28日まで判断保留") : `${followup ? 28 : 14}日分あり・運営操作等を確認して人が評価`,
      targetReached: resultRate === null || resultUsers === null ? null : resultRate >= .05 && resultUsers >= 10 };
  });
  return { period: s.plan.periods[periodName] ?? null, reviewAfter, rows };
}
export function pageDeviceViews(rows: RecordRow[] | null): RecordRow[] | null {
  if (rows === null) return null;
  const groups = new Map<string, RecordRow>();
  for (const r of rows) {
    const group = pageGroup(String(r.pagePath));
    const key = JSON.stringify([group, r.deviceCategory]);
    const item = groups.get(key) ?? { group, deviceCategory: r.deviceCategory, screenPageViews: 0 };
    item.screenPageViews = Number(item.screenPageViews) + Number(r.screenPageViews); groups.set(key, item);
  }
  return [...groups.values()];
}
export function summarize(s: Snapshot) {
  const totals = Object.fromEntries(Object.keys(s.plan.periods).map(p => [p, { ga: records(s.captures[p + ".ga.total"])?.[0] ?? null, gsc: records(s.captures[p + ".gsc.total"])?.[0] ?? null }]));
  const issues = [...expectedCaptureKeys(s.plan).filter(key => !s.captures[key]).map(key => `${key}: 未保存・取得不足`), ...Object.entries(s.captures).flatMap(([key, c]) => {
    const warnings = c.status === "ok" ? [] : [`${key}: ${c.status} ${c.message ?? ""}`];
    for (const page of c.pages) {
      const m = page.metadata;
      if (m && "timeZone" in m && m.timeZone !== "Asia/Tokyo") warnings.push(`${key}: GA4 timezoneが想定外: ${m.timeZone}`);
      if (m && "subjectToThresholding" in m && m.subjectToThresholding) warnings.push(`${key}: 閾値適用あり`);
      if (m && "dataLossFromOtherRow" in m && m.dataLossFromOtherRow) warnings.push(`${key}: (other)行への集約あり`);
      if (m && "samplingMetadatas" in m && m.samplingMetadatas?.length) warnings.push(`${key}: サンプリングあり`);
    }
    return warnings;
  })];
  return { schemaVersion: 1, generatedAt: s.generatedAt, plan: s.plan, complete: issues.length === 0, issues, totals, study: studySummary(s), studyFollowup: s.plan.periods.studyFollowup ? studySummary(s, "studyFollowup") : null,
    comparison: Object.fromEntries(["previous7", "current7", "previous28", "current28"].map(p => [p, {
      events: records(s.captures[p + ".ga.events"]), sourceAndDevice: records(s.captures[p + ".ga.compareSource"]),
      variants: records(s.captures[p + ".ga.variants"]), origins: records(s.captures[p + ".ga.compareOrigins"]),
      device: records(s.captures[p + ".ga.compareDevice"]), cta: records(s.captures[p + ".ga.compareCta"]),
      pageViews: sumGroups(records(s.captures[p + ".ga.pages"]), "pagePath", "screenPageViews"),
      pageViewsByDevice: pageDeviceViews(records(s.captures[p + ".ga.pages"])),
      searchClicks: sumGroups(records(s.captures[p + ".gsc.page"]), "page", "clicks"),
    }])) };
}
export function renderReport(s: Snapshot): string {
  const a = summarize(s);
  const sections = ["# GA4・GSC評価レポート", "", `取得: ${s.generatedAt} / 本番: ${s.host} / 集計終端: ${s.plan.end}`, "", ...s.plan.notes.map(n => `- ${n}`), "", "## 取得品質", "", ...(a.issues.length ? a.issues.map(i => `- ${i}`) : ["全リクエスト取得完了。APIの品質通知なし。匿名化・収集漏れ・処理遅延まで否定するものではない。"]), "", "## 全体の比較", ""];
  for (const [previous, current] of [["previous", "current"], ["previous7", "current7"], ["previous28", "current28"]]) {
    const before = a.totals[previous], after = a.totals[current];
    const range = s.plan.periods[current];
    sections.push(`### ${current}: ${range.startDate}〜${range.endDate}`, "", table(["指標", "前期間", "対象期間", "増減"], [
      ...["activeUsers", "totalUsers", "sessions", "screenPageViews"].map(k => { const b = numeric(before.ga?.[k]), c = numeric(after.ga?.[k]); return ["GA4 " + k, fmt(b), fmt(c), pct(b === null || c === null || !b ? null : c / b - 1)]; }),
      ...["clicks", "impressions"].map(k => { const b = numeric(before.gsc?.[k]), c = numeric(after.gsc?.[k]); return ["GSC " + k, fmt(b), fmt(c), pct(b === null || c === null || !b ? null : c / b - 1)]; }),
      ["GSC CTR", pct(numeric(before.gsc?.ctr)), pct(numeric(after.gsc?.ctr)), ""],
      ["GSC平均順位", fmt(before.gsc?.position), fmt(after.gsc?.position), "小さいほど上位"],
      ["GA4エンゲージメント率", pct(numeric(before.ga?.engagementRate)), pct(numeric(after.ga?.engagementRate)), "満足度ではない"],
    ]), "");
  }
  sections.push("## 比較への到達", "", "回数と総ユーザー数を分ける。ユーザー数は行・送り元・端末間で合算しない。ページ群のPVと比較利用は別集計で、順序付きファネル・因果効果を示さない。送り元URLは推測しない。", "");
  for (const p of ["previous7", "current7", "previous28", "current28"]) {
    const c = a.comparison[p];
    sections.push(`### ${p}`, "", table(["行動", "回数", "総ユーザー"], ["compare_ready", "compare_view", "compare_candidate_add", "compare_candidate_start", "compare_cta_view", "compare_cta_click", "shindan_run", "shindan_result_scroll", "shindan_result_click", "shindan_compare_click", "shindan_compare_top_click"].map(name => [name, fmt(event(c.events, name, "eventCount")), fmt(event(c.events, name, "totalUsers"))])), "");
    sections.push("人口ランキング3ページの施策別到達（登録済みcta_variantで識別）", "", table(["入口ページ", "閲覧ユーザー", "ボタン視認", "クリック", "着地", "描画完了", "比較表視認", "比較表視認/入口ユーザー（参考）"], ["hokkaido", "ibaraki", "aichi"].map(pref => {
      const attribution = rankingCompareAttribution("population-most", pref)!;
      const variant = compareAttributionParams(attribution).cta_variant;
      const cohort = c.variants?.filter(r => r["customEvent:cta_variant"] === variant && r["customEvent:measurement_version"] === "2026-10-09") ?? null;
      const origin = c.origins === null ? null : numeric(c.origins.find(r => r.pagePath === attribution.originPath)?.totalUsers ?? 0);
      const views = event(cohort, "compare_view", "totalUsers");
      return [attribution.originPath, fmt(origin), ...["compare_cta_view", "compare_cta_click", "tool_entry", "compare_ready", "compare_view"].map(name => fmt(event(cohort, name, "totalUsers"))), pct(ratio(views, origin))];
    })), "", "入口はpage_viewを送った期間ユーザー。ユーザーはページ・段階間で合算しない。URL共有や再訪を含むため厳密な順序付きファネルではない。公開当日・運営確認を除外して評価する。", "");
    sections.push("人数ボタン版（現行14日評価とは別集計）", "", table(["ツール", "視認ユーザー", "結果ユーザー", "結果/視認ユーザー（参考）"], [
      { tool: "電気", prefix: "denki", variant: "people-buttons-v2" },
      { tool: "備蓄", prefix: "stockpile", variant: "water-buttons-v2" },
    ].map(d => {
      const cohort = c.variants?.filter(r => r["customEvent:cta_variant"] === d.variant && r["customEvent:measurement_version"] === "2026-11-12") ?? null;
      const views = event(cohort, d.prefix + "_entry_view", "totalUsers"), results = event(cohort, d.prefix + "_quick_result_view", "totalUsers");
      return [d.tool, fmt(views), fmt(results), pct(ratio(results, views))];
    })), "", "未公開・反映待ちの0件を失敗判定にしない。v2の公開日翌日から14日を別に固定して評価し、v1の観測期間へ混ぜない。", "");
    if (c.sourceAndDevice === null) sections.push("送り元別: 取得不可", "");
    else sections.push(table(["行動", "送り元分類", "端末", "回数", "総ユーザー"], c.sourceAndDevice.filter(r => ["compare_view", "compare_candidate_add", "tool_entry"].includes(String(r.eventName))).map(r => [r.eventName, r["customEvent:tool_source"], r.deviceCategory, fmt(r.eventCount), fmt(r.totalUsers)])), "");
    sections.push(table(["行動", "端末", "回数", "総ユーザー"], (c.device ?? []).map(r => [r.eventName, r.deviceCategory, fmt(r.eventCount), fmt(r.totalUsers)])), c.device === null ? "端末別: 取得不可" : "", "");
    sections.push(table(["ページ群", "端末", "PV"], (c.pageViewsByDevice ?? []).map(r => [r.group, r.deviceCategory, fmt(r.screenPageViews)])), c.pageViewsByDevice === null ? "ページ群×端末: 取得不可" : "", "");
    sections.push("対象ページ限定CTA（旧2ページ・新3ページをページ別に確認）", "", table(["行動", "ページ", "端末", "回数", "総ユーザー"], (c.cta ?? []).map(r => [r.eventName, r.pagePath, r.deviceCategory, fmt(r.eventCount), fmt(r.totalUsers)])), c.cta === null ? "取得不可" : "", "", table(["ページ群", "PV", "検索クリック（ページ集計）"], ["ランキング", "自治体詳細", "地図", "比較", "診断"].map(group => [group, c.pageViews === null ? "—" : fmt(c.pageViews[group] ?? 0), c.searchClicks === null ? "—" : fmt(c.searchClicks[group] ?? 0)])), "");
  }
  sections.push("## #241 電気・備蓄の固定評価", "", `観測: ${a.study.period ? a.study.period.startDate + "〜" + a.study.period.endDate : "未開始"}。評価開始目安: ${STUDY.reviewAfter}。公開当日10/31は除外。`, "", table(["新版", "入口視認回数", "視認ユーザー", "入力ユーザー", "結果ユーザー", "結果/視認ユーザー", "初期目標", "状態"], a.study.rows.map(r => [r.tool + " / " + r.variant, fmt(r.views), fmt(r.viewUsers), fmt(r.interactions), fmt(r.resultUsers), pct(r.resultRate), r.targetReached === null ? "不明" : r.targetReached ? "参考値上は到達" : "参考値上は未到達", r.state])), "", "同一measurement_version=2026-10-31・cta_variantの組み合わせだけを集計。結果は描画イベントで、結果自体の視認・滞在を保証しない。期間ユーザー比率であり、順序付きファネルではない。", "", "初期目標: 結果表示率5%以上かつ各機能10人以上。入口500視認未満は28日まで判断保留。運営者操作・取得品質を確認して人が評価し、#242の公開は自動判定しない。", "", "基準10/17〜10/30は交通量の参考比較。視認定義が10/24に変わっているため、新版との同条件CTR比較はしない。10/25〜10/30は補助期間。旧版に存在しないquick_resultの増加率は出さない。", "");
  if (a.studyFollowup) sections.push("### 28日までの追加観測", "", table(["新版", "入口視認回数", "視認ユーザー", "結果ユーザー", "結果/視認ユーザー", "状態"], a.studyFollowup.rows.map(r => [r.tool, fmt(r.views), fmt(r.viewUsers), fmt(r.resultUsers), pct(r.resultRate), r.state])), "", `期間: ${a.studyFollowup.period?.startDate}〜${a.studyFollowup.period?.endDate}。28日評価目安: ${a.studyFollowup.reviewAfter}。14日評価とは別表で保持する。`, "");
  for (const p of ["studyBaseline", "studyComparable", "study", "studyFollowup"]) {
    if (!s.plan.periods[p]) continue;
    const events = records(s.captures[p + ".ga.events"]);
    const range = s.plan.periods[p];
    sections.push(`### ${p}: ${range.startDate}〜${range.endDate}`, "", table(["詳細利用", "回数", "総ユーザー"], ["denki_entry_click", "denki_simulate", "denki_offer_view", "denki_offer_click", "stockpile_entry_click", "stockpile_start", "stockpile_list_view", "stockpile_copy", "stockpile_print"].map(name => [name, fmt(event(events, name, "eventCount")), fmt(event(events, name, "totalUsers"))])), "");
  }
  sections.push("## 解釈の制限", "", "- 比較成立・視認は10/09版。導入前の0件を利用減や増加率の基準にしない。", "- GSCのページ・クエリ・プロパティ集計は一致しない場合がある。クエリは匿名化・上位返却の制約がある。", "- 未登録のカスタム定義、取得失敗、部分取得は『—』。取得成功時に行がないイベントのみ0件。", "- session/ユーザー指標の次元別合計は全体と一致するとは限らない。ASP成果・報酬・満足度・継続率は未確認。", "");
  return sections.join("\n");
}
