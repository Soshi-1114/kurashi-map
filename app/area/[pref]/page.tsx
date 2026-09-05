import "../../league.css";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wallet, MapIcon, BarChart3, ArrowLeft, ArrowUpRight, Building2, Users, Compass, Star, ShieldAlert } from "lucide-react";
import { listMunicipalities, listAll } from "@/lib/metrics";
import {
  RANKINGS, getRankingBySlug, rankBy,
  POPULATION_FRESHNESS, CENSUS_PERIOD, housingSurveyLabel, landPriceSurveyLabel, freshnessPrefix,
} from "@/lib/rankings";
import { getPrefMetricSummaries } from "@/lib/prefAggregates";
import RankLinkList from "@/components/RankLinkList";
import RankSources from "@/components/RankSources";
import { PREFS, getPrefBySlug } from "@/lib/prefs";
import { mapHrefForPref } from "@/lib/mapDeepLink";
import { shindanHref } from "@/lib/siteNav";
import { SITE, absoluteUrl } from "@/lib/site";
import { hasRent, rentBand } from "@/lib/rentColor";
import { livabilityBands } from "@/lib/livabilityScore";
import { buildPrefHazardRows } from "@/lib/prefHazardTable";
import { PREF_RANKINGS } from "@/lib/prefRankings";
import { HAZARD_MAX_LEVEL_DISCLAIMER } from "@/lib/hazardScale";
import { hasLandPrice } from "@/lib/landPrice";
import { isWaitlistDisclosed } from "@/lib/waitlist";
import type { Municipality } from "@/lib/types";
import PageShell from "@/components/PageShell";
import { PrefMuniTable, type PrefMuniRow } from "@/components/area/PrefMuniTable";

type Params = { pref: string };

export function generateStaticParams() {
  return PREFS.map((p) => ({ pref: p.slug }));
}

/** 県別ランキングページへの「もっと見る」導線（家賃・人口セクション共通）。 */
function RankMoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rk-duo-more">
      {label}
      <ArrowUpRight size={14} aria-hidden="true" />
    </Link>
  );
}

/** 整数配列の中央値（偶数長は平均を四捨五入）。空なら 0。 */
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** 県の市区町村から集計指標を出す（メタデータと本文で共有）。 */
function prefStats(muni: Municipality[]) {
  const rents = muni.map((m) => m.rent.value).filter(hasRent);
  const waitlistZero = muni.filter(
    (m) => isWaitlistDisclosed(m.waitlistChildren) && m.waitlistChildren.value === 0,
  ).length;
  const floodCount = muni.filter((m) => m.hazard.hasFloodRisk).length;
  // 基準年度の表示用。家賃は県内で単一年度、地価は地価公示・地価調査が混在しうるため
  // 県内に現れる「年度+調査名」ラベルを重複排除して列挙する（実データの asOf 由来）。
  // データなし県（rents が空）はデータ更新のタイミング次第で理論上ありうるため、
  // その場合だけ調査名のみのフォールバックにする。
  const rentAsOf = muni.find((m) => hasRent(m.rent.value))?.rent.asOf ?? null;
  const rentSurveyLabel = rentAsOf ? housingSurveyLabel(rentAsOf) : "住宅・土地統計調査";
  const landPriceLabels = [...new Set(
    muni
      .filter((m) => hasLandPrice(m.landPrice.value))
      .map((m) => landPriceSurveyLabel(m.landPrice.source, m.landPrice.asOf)),
  )].join("・");
  return {
    count: muni.length,
    rentMedian: median(rents),
    rentMin: rents.length ? Math.min(...rents) : 0,
    rentMax: rents.length ? Math.max(...rents) : 0,
    waitlistZero,
    floodCount,
    rentSurveyLabel,
    landPriceLabels,
    rentAsOf,
  };
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const pref = getPrefBySlug(params.pref);
  if (!pref) return { title: "見つかりません | KurashiMap" };
  const muni = await listMunicipalities(params.pref);
  const { count, rentMedian, rentSurveyLabel, rentAsOf } = prefStats(muni);
  // description 冒頭の「更新」バッジ。description には家賃中央値の asOf しか
  // 書かないので、それ以外の指標（地価等）は混ぜない。
  const freshness = freshnessPrefix([rentAsOf]);
  const medPhrase =
    rentMedian > 0 ? `家賃の県内中央値${rentMedian.toLocaleString()}円/月（${rentSurveyLabel}）、` : "";
  // title/description には「家賃相場ランキング」等、/ranking/rent-cheap|high/{pref} と
  // 完全一致する語を含めない。2026-08 GSC分析で「{県} 相場」系クエリがこのハブページに
  // 30〜40位で着地し、平均5〜9位で走っている該当ランキングページを食っていた
  // （docs/seo/kurashimap-gsc-analysis-2026-08-10.md §9 参照）。
  const title = `${pref.nameJa}の住みやすさ・市区町村データ｜${count}市区町村を比較｜${SITE.name}`;
  const description = `${freshness}${pref.nameJa}の全${count}市区町村の${medPhrase}地価・人口・待機児童・災害リスク・外国人比率を一覧で比較。家賃・地価が安い自治体や子育て環境を、政府統計の実データでチェックできる${SITE.name}の都道府県ページ。`;
  const url = absoluteUrl(`/area/${pref.slug}`);
  const ogImage = absoluteUrl(`/api/og/pref/${pref.slug}`);
  return {
    title,
    description,
    metadataBase: new URL(SITE.baseUrl),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url,
      title,
      description,
      siteName: SITE.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${pref.nameJa}の住みやすさ` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function PrefPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const pref = getPrefBySlug(params.pref);
  if (!pref) notFound();

  const prefName = pref.nameJa;
  const muni = await listMunicipalities(params.pref);
  const all = await listAll(params.pref); // 市区町村 + 行政区（クロール用の全リンク）
  const stats = prefStats(muni);

  // 家賃が安い市区町村ランキング（実データのみ・昇順 上位10）
  const cheapest = muni
    .filter((m) => hasRent(m.rent.value))
    .sort((a, b) => a.rent.value - b.rent.value)
    .slice(0, 10);
  const cheapPodium = cheapest.slice(0, 3);
  const cheapLadder = cheapest.slice(3, 10);

  // 住みやすさ総合スコアの上位バンド（同点をまとめた形）。
  // 「{県} 住みやすさ」は 2026-09 実測で 659表示・クリック0・平均28〜44位と、
  // 需要はあるのに答えを持てていなかったクエリ。順位表にしないのは意図的で、
  // スコアが17段階しかなく同点が多数出るため（lib/livabilityScore.livabilityBands）。
  const livBands = livabilityBands(muni, 3);

  // 市区町村別の災害リスク一覧。**順位も該当リストも作らない**（全自治体をそのまま並べる）。
  // 理由は lib/prefHazardTable.ts の冒頭コメント: 「浸水想定なし」を抜き出すと
  // 区域指定の進み具合を安全性と取り違えさせるため。
  const hazardRows = buildPrefHazardRows(muni);
  const hazardEvaluated = hazardRows.filter((r) => r.evaluated).length;

  // 全自治体一覧（行政コード順 = 行政の標準的な並び）。displayName で区はフルネーム表示。
  const listed = [...all].sort((a, b) => a.code.localeCompare(b.code));
  // テーブル表示用の軽量な行（Municipality 全体ではなく表示に必要な値だけを
  // クライアントコンポーネントへ渡す）。並び替えは PrefMuniTable 側で行う。
  const listedRows: PrefMuniRow[] = listed.map((m) => ({
    code: m.code,
    pref: m.pref,
    label: m.displayName ?? m.name,
    rent: m.rent.value,
    landPrice: m.landPrice.value,
    population: m.population,
  }));

  // 人口・人口増減の県内上位（ランキング定義の qualifies/display を流用。上位5のみの
  // コンパクト表示にとどめ、全順位は県別ランキングページへ誘導する）。
  const popDef = getRankingBySlug("population-most");
  const growthDef = getRankingBySlug("population-growth");
  const popTop = popDef ? rankBy(popDef, muni, 5) : [];
  const growthTop = growthDef ? rankBy(growthDef, muni, 5) : [];

  // 県のデータ概況（県内中央値と、その中央値で47都道府県を並べた順位）。
  // 「{県} 住みやすさ」が県ハブだけに着地し平均35.6位（2026-08 GSC分析）＝内容の薄さが
  // 原因と判断したため、47ページが実データで確実に異なる中身を持つようにする。
  const prefSummaries = (await getPrefMetricSummaries()).get(pref.slug) ?? [];

  // 県別ランキングへの導線。データのある指標だけを全件並べる（従来は家賃・人口の4本のみ
  // で、14指標×47県のページが既に存在するのに大半が孤立していた）。
  const prefRankings = RANKINGS.filter((r) => muni.some(r.qualifies));

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: prefName, item: absoluteUrl(`/area/${pref.slug}`) },
        ],
      },
      {
        "@type": "AdministrativeArea",
        name: prefName,
        addressCountry: "JP",
        identifier: pref.codePrefix,
        url: absoluteUrl(`/area/${pref.slug}`),
      },
      {
        "@type": "ItemList",
        name: `${prefName}の市区町村`,
        numberOfItems: listed.length,
        itemListElement: listed.map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: m.displayName ?? m.name,
          url: absoluteUrl(`/area/${m.pref}/${m.code}`),
        })),
      },
    ],
  };

  return (
    <PageShell innerClassName="rk-root" trail={[{ name: SITE.name, href: "/" }, { name: prefName }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />


      <header className="rk-hero rk-reveal">
        <span className="rk-eyebrow"><MapIcon size={14} aria-hidden="true" />都道府県データ</span>
        <h1 className="rk-title">
          {prefName}
          <span className="rk-title-sub">の住みやすさ・市区町村比較</span>
        </h1>
        <p className="rk-lead">
          {prefName}の全<strong>{stats.count}</strong>市区町村を、家賃平均・地価・人口・待機児童・災害リスクで横断比較。
          {stats.rentMedian > 0 && (
            <>家賃平均の県内中央値は<strong>{stats.rentMedian.toLocaleString()}</strong>円/月（{stats.rentMin.toLocaleString()}〜{stats.rentMax.toLocaleString()}円/月・{stats.rentSurveyLabel}）、</>
          )}
          待機児童ゼロは<strong>{stats.waitlistZero}</strong>自治体です。
        </p>

        <ul className="rk-kpis">
          <li className="rk-kpi is-highlight">
            <span className="rk-kpi-label">市区町村数</span>
            <span className="rk-kpi-value">{stats.count}<span className="rk-kpi-unit">市区町村</span></span>
          </li>
          <li className="rk-kpi">
            <span className="rk-kpi-label">家賃の県内中央値</span>
            {stats.rentMedian > 0 ? (
              <span className="rk-kpi-value">{stats.rentMedian.toLocaleString()}<span className="rk-kpi-unit">円/月</span></span>
            ) : (
              <span className="rk-kpi-value is-nodata">データなし</span>
            )}
          </li>
          <li className="rk-kpi">
            <span className="rk-kpi-label">待機児童ゼロ</span>
            <span className="rk-kpi-value">{stats.waitlistZero}<span className="rk-kpi-unit">自治体</span></span>
          </li>
          <li className="rk-kpi">
            <span className="rk-kpi-label">浸水想定あり</span>
            <span className="rk-kpi-value">{stats.floodCount}<span className="rk-kpi-unit">自治体</span></span>
          </li>
        </ul>

        <div className="rk-hero-actions">
          <Link href={mapHrefForPref(pref.slug)} className="rk-action rk-action-primary">
            <MapIcon size={15} aria-hidden="true" />地図で{prefName}を見る
          </Link>
          <Link href="/ranking" className="rk-action rk-action-ghost">
            <BarChart3 size={15} aria-hidden="true" />全国ランキングを見る
          </Link>
        </div>
      </header>

      {prefSummaries.length > 0 && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon"><BarChart3 size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">{prefName}のデータ概況</h2>
              <p className="rk-section-sub">
                県内の市区町村を値の順に並べた「中央値」と、その中央値で全国の都道府県を並べたときの位置です。
              </p>
            </div>
          </div>
          <div className="rk-table-wrap">
            <div className="pref-table-wrap">
              <table className="pref-table">
                <thead>
                  <tr>
                    <th scope="col">指標</th>
                    <th scope="col" className="num">{prefName}の中央値</th>
                    <th scope="col" className="num">全国の中央値</th>
                    <th scope="col" className="num">全国順位（高い順）</th>
                  </tr>
                </thead>
                <tbody>
                  {prefSummaries.map((s) => (
                    <tr key={s.slug}>
                      <th scope="row">{s.label}</th>
                      <td className="num">
                        {s.valueText}
                        <span className="rk-cell-note">{s.medianMuniName}</span>
                      </td>
                      <td className="num">{s.nationalText}</td>
                      <td className="num">{s.rank} / {s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="rk-section-sub">
            中央値は「県内の市区町村を値の順に並べた真ん中の自治体の値」で、平均ではありません（人口規模による重み付けをしていません）。
            順位は値が高い順で、高い・低いに優劣の意味はありません。データのない自治体は集計に含めていません。
          </p>
          {/* 都道府県ランキングへの導線。この表の順位（県内中央値ベース）とは別の数字なので、
              「同じ順位の詳細」と誤読されないよう違いを本文で明示する。 */}
          <p className="rk-section-sub">
            なお上の順位は<strong>県内の中央値</strong>で都道府県を並べたものです。
            県全体の値（公表値、または県内市区町村の実数を合算した値）で47都道府県を並べたランキングは別にあり、
            算出方法が違うため順位も一致しません。
          </p>
          <ul className="pref-chip-grid">
            {PREF_RANKINGS.map((r) => (
              <li key={r.slug}>
                <Link href={`/ranking/${r.slug}/prefecture`} className="pref-chip">
                  {r.shortLabel}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {livBands.length > 0 && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon rk-tone-pop"><Star size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">{prefName}の住みやすさスコア</h2>
              <p className="rk-section-sub">
                交通アクセス・家賃・保育・災害リスク・生活インフラの5軸を、政府統計の実データから
                星1〜5で評価して平均した「目安」です（100点満点）。データのない軸は算出から除き、母数を補正しています。
              </p>
            </div>
          </div>
          <ul className="pref-liv-bands">
            {livBands.map((band) => (
              <li key={band.score} className="pref-liv-band">
                <span className="pref-liv-score">
                  <b>{band.score}</b><span className="pref-liv-unit">点</span>
                </span>
                <ul className="pref-chip-grid">
                  {band.munis.map((m) => (
                    <li key={m.code}>
                      <Link href={`/area/${m.pref}/${m.code}`} className="pref-chip">
                        {m.displayName ?? m.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="rk-section-sub">
            スコアは5軸の星（各1〜5）の平均なので取りうる値が限られ、<strong>同じ点数の自治体が多く並びます</strong>。
            そのため順位（1位・2位…）ではなく同点をまとめて表示しています。
            また、交通アクセスと生活インフラの軸は施設の実数を用いるため、規模の大きい自治体ほど高く出る傾向があります。
            点数の高さは利便性の目安であって、暮らしの良し悪しを決めるものではありません。
          </p>
          <div className="rk-hero-actions">
            <Link href={shindanHref("pref_hub")} className="rk-action rk-action-primary">
              <Compass size={15} aria-hidden="true" />重視する条件を選んで診断する
            </Link>
          </div>
        </section>
      )}

      {cheapPodium.length > 0 && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon rk-tone-rent"><Wallet size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">家賃で見る</h2>
              <p className="rk-section-sub">{prefName}内で民営借家の家賃平均が低い順 上位{cheapest.length}自治体。全順位は家賃ランキングページで確認できます。</p>
            </div>
          </div>

          <ol className="rk-podium" aria-label="家賃が安いトップ3">
            {cheapPodium.map((m, i) => (
              <li key={m.code} style={{ display: "contents" }}>
                <Link href={`/area/${m.pref}/${m.code}`} className={`rk-podium-card is-${i + 1}`}>
                  <span className="rk-medal" aria-label={`${i + 1}位`}>{i + 1}</span>
                  <span className="rk-podium-body">
                    <span className="rk-podium-name">{m.displayName ?? m.name}</span>
                    <span className="rk-podium-pref">{rentBand(m.rent.value)}</span>
                    <span className="rk-podium-value">{m.rent.value.toLocaleString()}円/月</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {cheapLadder.length > 0 && (
            <ol className="rk-ladder" start={4}>
              {cheapLadder.map((m, i) => (
                <li key={m.code}>
                  <Link href={`/area/${m.pref}/${m.code}`} className="rk-ladder-row">
                    <span className="rk-ladder-rank">{i + 4}</span>
                    <span className="rk-ladder-name">{m.displayName ?? m.name}</span>
                    <span className="rk-ladder-value">
                      {m.rent.value.toLocaleString()}円/月
                      <span className="rk-ladder-band">{rentBand(m.rent.value)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <div className="rk-more-links">
            <RankMoreLink href={`/ranking/rent-cheap/${pref.slug}`} label={`${prefName}の家賃相場ランキング（安い順）を見る`} />
            <RankMoreLink href={`/ranking/rent-high/${pref.slug}`} label={`${prefName}の家賃相場ランキング（高い順）を見る`} />
          </div>
        </section>
      )}

      {(popTop.length > 0 || growthTop.length > 0) && popDef && growthDef && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon rk-tone-pop"><Users size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">人口・人口増減で見る</h2>
              <p className="rk-section-sub">{prefName}内の人口が多い自治体と、人口増減率（{CENSUS_PERIOD}）が高い自治体。</p>
            </div>
          </div>
          <div className="rk-duo">
            {popTop.length > 0 && (
              <div>
                <h3 className="rk-duo-h">人口が多い 上位{popTop.length}</h3>
                <ol className="rk-ladder">
                  {popTop.map((m, i) => (
                    <li key={m.code}>
                      <Link href={`/area/${m.pref}/${m.code}`} className="rk-ladder-row">
                        <span className="rk-ladder-rank">{i + 1}</span>
                        <span className="rk-ladder-name">{m.displayName ?? m.name}</span>
                        <span className="rk-ladder-value">{popDef.display(m)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <RankMoreLink href={`/ranking/population-most/${pref.slug}`} label={`${prefName}の人口ランキングを見る`} />
              </div>
            )}
            {growthTop.length > 0 && (
              <div>
                <h3 className="rk-duo-h">人口増減率が高い 上位{growthTop.length}</h3>
                <ol className="rk-ladder">
                  {growthTop.map((m, i) => (
                    <li key={m.code}>
                      <Link href={`/area/${m.pref}/${m.code}`} className="rk-ladder-row">
                        <span className="rk-ladder-rank">{i + 1}</span>
                        <span className="rk-ladder-name">{m.displayName ?? m.name}</span>
                        <span className="rk-ladder-value">{growthDef.display(m)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <RankMoreLink href={`/ranking/population-growth/${pref.slug}`} label={`${prefName}の人口増減ランキングを見る`} />
              </div>
            )}
          </div>
        </section>
      )}

      <RankLinkList
        title={`${prefName}のランキングで比べる`}
        sub={`${prefName}内の市区町村を、指標ごとに並べて比較できます。`}
        rankings={prefRankings}
        href={(r) => `/ranking/${r.slug}/${pref.slug}`}
        labelPrefix={`${prefName}の`}
      />

      {hazardRows.length > 0 && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon rk-tone-hazard"><ShieldAlert size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">{prefName}の市区町村別 災害リスク</h2>
              <p className="rk-section-sub">
                県内 {hazardRows.length} 市区町村の洪水・土砂・津波・高潮の想定を、行政コード順にそのまま並べています（リスクの大小では並べ替えていません）。
              </p>
            </div>
          </div>
          <div className="rk-table-wrap">
            <div className="pref-table-wrap">
              <table className="pref-table">
                <thead>
                  <tr>
                    <th scope="col">自治体</th>
                    <th scope="col">洪水（最大浸水深）</th>
                    <th scope="col">土砂災害</th>
                    <th scope="col">津波</th>
                    <th scope="col">高潮</th>
                  </tr>
                </thead>
                <tbody>
                  {hazardRows.map((r) => (
                    <tr key={r.code}>
                      <th scope="row">
                        <Link href={`/area/${pref.slug}/${r.code}`} className="pref-table-link">{r.name}</Link>
                      </th>
                      <td>{r.flood}</td>
                      <td>{r.landslide}</td>
                      <td>{r.tsunami}</td>
                      <td>{r.stormSurge}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="rk-section-sub">
            出典は国土数値情報（不動産情報ライブラリ）です。表示しているのは各自治体内で確認された<strong>最大の区分</strong>で、{HAZARD_MAX_LEVEL_DISCLAIMER}
            「想定なし」は洪水浸水想定区域などが<strong>指定されていない</strong>ことを示すもので、災害が起きないことを意味しません。
            区域の指定状況は河川管理者や地域によって差があります。「対象外」は元データの整備範囲外です
            （評価済み {hazardEvaluated} / {hazardRows.length} 自治体）。
          </p>
          <div className="rk-hero-actions">
            <Link href={mapHrefForPref(pref.slug, "/map/hazard")} className="rk-action rk-action-primary">
              <MapIcon size={15} aria-hidden="true" />{prefName}の災害リスクを地図で見る
            </Link>
          </div>
        </section>
      )}

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><Building2 size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">{prefName}の全市区町村一覧</h2>
            <p className="rk-section-sub">自治体名から、家賃・地価・子育て・災害リスクの詳細ページへ。見出しクリックで並び替えできます。</p>
          </div>
        </div>
        <div className="rk-table-wrap">
          <PrefMuniTable rows={listedRows} />
        </div>
      </section>

      <RankSources>
        本ページの数値は政府統計・国土数値情報の実データです。家賃は{stats.rentSurveyLabel}、人口は{POPULATION_FRESHNESS}（ともに e-Stat 経由）、地価は{stats.landPriceLabels || "地価公示・地価調査"}、ハザードは不動産情報ライブラリ（reinfolib）／国土数値情報、待機児童はこども家庭庁の公表値に基づきます。データのない項目は推計で埋めず「—／データなし」と明示しています。
      </RankSources>

      <nav className="rk-footnav" aria-label="関連リンク">
        <Link href={mapHrefForPref(pref.slug)} className="rk-back"><ArrowLeft size={15} aria-hidden="true" />地図で{prefName}を見る</Link>
        <Link href="/ranking" className="rk-back"><ArrowUpRight size={15} aria-hidden="true" />全国ランキング</Link>
      </nav>
    </PageShell>
  );
}
