"use client";

import { useState } from "react";
import Link from "@/components/SiteLink";
import { PREFS, REGIONS } from "@/lib/prefs";
import { navigateDocument } from "@/lib/adsense";
import { compareHref } from "@/lib/siteNav";
import { track } from "@/lib/analytics";
import { useCompareSelection } from "@/components/compare/CompareSelectionProvider";
import { parseRankingScope, rankingFeedbackPage, rankingScopeHref, rankingScopeLabel, scopedRankingRows, type RankingRow, type RankingScope } from "@/lib/rankingScope";
import { useRankingScope } from "@/lib/useRankingScope";
import DisplayAd from "@/components/monetization/DisplayAd";
import { ShareButton } from "@/components/ShareButton";
import ContentFeedback from "@/components/ContentFeedback";
import { useRankingRestTracking } from "@/lib/useRankingRestTracking";

export default function RankingExplorer({ rows, metric, columnLabel, isList, initialPref, metrics, topCompare }: {
  rows: RankingRow[];
  metric: string;
  columnLabel: string;
  isList: boolean;
  initialPref?: string;
  metrics: { slug: string; label: string }[];
  topCompare?: React.ReactNode;
}) {
  const initial = parseRankingScope(null, initialPref);
  const scope = useRankingScope(initialPref);
  const [query, setQuery] = useState("");
  const { toggle, candidates } = useCompareSelection();
  const scoped = scopedRankingRows(rows, scope);
  const ranked = scoped.map((row, i) => ({ ...row, position: i + 1 }));
  const normalized = query.normalize("NFKC").trim().toLocaleLowerCase("ja");
  const restTracking = useRankingRestTracking(metric, initialPref, normalized);
  const matches = normalized ? ranked.filter(row => `${row.name}${PREFS.find(p => p.slug === row.pref)?.nameJa ?? ""}`.normalize("NFKC").toLocaleLowerCase("ja").includes(normalized)) : ranked;
  // 通常の全国版は上位100件。検索時は全有効自治体が対象で、元の順位も保持する。
  const shown = !normalized && scope === "all" ? matches.slice(0, 100) : matches;
  const first = shown.slice(0, 10);
  const rest = shown.slice(10);
  const label = rankingScopeLabel(scope);
  const source = initialPref ? "pref_ranking_top3" : "ranking_top3";
  const scopedCompare = !isList && scoped.length >= 2 ? compareHref(scoped.slice(0, 3).map(r => r.code), source) : null;
  const chooseScope = (next: RankingScope) => {
    track("ranking_scope_select", { metric_key: metric, section: next, measurement_version: "2026-11-16" });
    navigateDocument(rankingScopeHref(metric, next));
  };

  const table = (items: typeof ranked, caption: string, rest = false) => <table className="rk-compact-table">
    <caption className="sr-only">{caption}</caption>
    <thead><tr><th scope="col">{isList ? "掲載順" : "順位"}</th><th scope="col">市区町村</th><th scope="col">{columnLabel}</th><th scope="col"><span className="sr-only">比較候補</span></th></tr></thead>
    <tbody>{items.map((row, index) => {
      const saved = candidates.some(c => c.code === row.code);
      const full = candidates.length >= 3 && !saved;
      return <tr key={row.code} ref={rest && index === 0 ? restTracking.firstRow : undefined} className={row.position <= 3 ? "rk-compact-top" : undefined}>
        <td className="rk-compact-rank">{row.position}</td>
        <th scope="row"><Link href={`/area/${row.pref}/${row.code}`}><span>{row.name}</span>{!initialPref && <small>{PREFS.find(p => p.slug === row.pref)?.nameJa}</small>}</Link></th>
        <td className="rk-compact-value">{row.value}</td>
        <td><button type="button" className="rk-compact-add" disabled={saved || full} aria-label={saved ? `${row.name}を比較候補に追加済み` : `${row.name}を比較候補に追加`} title={full ? "比較候補は3件までです" : undefined} onClick={() => toggle({ code: row.code, name: row.name, pref: row.pref, source: "ranking_row" })}>{saved ? "済" : "＋"}</button></td>
      </tr>;
    })}</tbody>
  </table>;

  return <section className="rk-explorer" aria-label="地域を選んでランキングを調べる">
    <div className="rk-explorer-controls">
      <label>対象地域<select value={scope} onChange={e => chooseScope(e.target.value as RankingScope)}>
        <option value="all">全国</option>
        <optgroup label="地方">{REGIONS.map(r => <option key={r.key} value={`region:${r.key}`}>{r.nameJa}</option>)}</optgroup>
        <optgroup label="都道府県">{PREFS.slice().sort((a, b) => a.codePrefix.localeCompare(b.codePrefix)).map(p => <option key={p.slug} value={`pref:${p.slug}`}>{p.nameJa}</option>)}</optgroup>
      </select></label>
      <label>調べる指標<select value={metric} onChange={e => navigateDocument(rankingScopeHref(e.target.value, scope))}>{metrics.map(m => <option key={m.slug} value={m.slug}>{m.label}</option>)}</select></label>
      <label><span className="sr-only">市区町村を検索</span><input type="search" value={query} placeholder="市区町村名を入力" onChange={e => setQuery(e.target.value)} /></label>
    </div>
    <div className="rk-explorer-heading"><h2>{label}の{isList ? "該当自治体一覧" : "ランキング"}</h2><p role="status">対象{scoped.length.toLocaleString()}自治体{normalized ? `・検索結果${matches.length.toLocaleString()}件` : scope === "all" ? "・上位100件を掲載（検索は全件対象）" : ""}</p></div>
    {scope === "region:kanto" && <p className="rk-explorer-note">関東：1都6県</p>}
    {isList && <p className="rk-explorer-note">順位ではなく、条件に該当する自治体の一覧です。</p>}
    <div className="rk-explorer-grid">
      <div className="rk-explorer-first">
        {first.length ? table(first, `${label}の${columnLabel}・先頭10件`) : <p className="rk-explorer-empty">{normalized ? "該当する自治体がありません。名前を短くするか、対象地域を変えてください。" : "この地域では対象のデータがありません。対象地域や指標を変えてください。"}</p>}
        <div hidden={Boolean(normalized)}>{(topCompare && scope === initial) ? topCompare : scopedCompare && <p className="rk-explorer-compare"><Link href={scopedCompare}>上位{Math.min(3, scoped.length)}自治体を比較する</Link></p>}</div>
      </div>
      {rows.length > 0 && <div className="rk-explorer-ad"><DisplayAd placement="ranking" /></div>}
      {rest.length > 0 && <details ref={restTracking.details} onToggle={restTracking.onToggle} className="rk-explorer-rest" key={`${scope}:${normalized}`}><summary ref={restTracking.summary} onClick={restTracking.onSummaryClick}>11件目以降を表示（残り{rest.length.toLocaleString()}件）</summary>{table(rest, `${label}の${columnLabel}・11件目以降`, true)}</details>}
    </div>
    {scope.startsWith("region:") && <details className="rk-update"><summary>対象の都道府県を確認</summary><p>{PREFS.filter(p => REGIONS.find(r => `region:${r.key}` === scope)?.prefixes.includes(p.codePrefix)).sort((a, b) => a.codePrefix.localeCompare(b.codePrefix)).map(p => p.nameJa).join("・")}</p></details>}
    <div className="rk-explorer-share"><ShareButton title={`${label}の${columnLabel}`} path={rankingScopeHref(metric, scope)} contentType="ranking" itemId={metric} className="rk-action rk-action-ghost" label="この地域のランキングを共有" /></div>
    <ContentFeedback key={rankingFeedbackPage(metric, scope)} page={rankingFeedbackPage(metric, scope)} section="ranking" />
  </section>;
}
