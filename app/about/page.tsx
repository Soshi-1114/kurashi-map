// サイトについて・データの出典と更新方針。E-E-A-T（運営の透明性）と
// 「◯◯ データ 出典」系クエリの受け皿を兼ねるページ。
// 基準時点はビルド時に実データ（サンプル自治体の asOf）から取り、表示と実データの
// 乖離を防ぐ（誠実性方針）。次回更新予定は lib/rankings の NEXT_UPDATE と同期。

import Link from "next/link";
import type { Metadata } from "next";
import { getMunicipality } from "@/lib/metrics";
import { NEXT_UPDATE, formatAsOfJa } from "@/lib/rankings";
import { SITE, absoluteUrl } from "@/lib/site";
import { HAZARD_MAX_LEVEL_DISCLAIMER } from "@/lib/hazardScale";
import PageShell from "@/components/PageShell";

const PATH = "/about";
const TITLE = `${SITE.name}について｜データの出典と更新方針`;
const DESC =
  "KurashiMapは全国1,918エリア（市区町村と政令指定都市の行政区）の住みやすさ関連データを地図で比較できる無料サービスです。全データの出典（政府統計）・基準時点・算出方法・更新頻度・次回更新予定と、推計値を使わない運営方針を公開しています。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL(SITE.baseUrl),
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: absoluteUrl(PATH),
    title: TITLE,
    description: DESC,
    siteName: SITE.name,
    images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

type SourceRow = {
  label: string;
  source: string;
  asOf: string;
  cycle: string;
  next?: string;
};

// 基準時点はサンプル自治体（さいたま市）の実データ asOf から取得する。
// 全自治体で同一期のデータを収録しているため、1件で代表できる。
async function loadRows(): Promise<SourceRow[]> {
  const m = await getMunicipality("11100");
  if (!m) return [];
  return [
    {
      label: "家賃（民営借家の平均）",
      source: "総務省 住宅・土地統計調査（e-Stat）",
      asOf: formatAsOfJa(m.rent.asOf),
      cycle: "5年ごと",
      next: NEXT_UPDATE.rent,
    },
    {
      label: "地価（住宅地平均）",
      source: "国土交通省 地価公示（国土数値情報 L01）",
      asOf: formatAsOfJa(m.landPrice.asOf),
      cycle: "年1回（1月1日時点・3月公表）",
      next: NEXT_UPDATE.landPrice,
    },
    {
      label: "人口・人口増減率",
      source: "総務省 国勢調査（e-Stat）",
      asOf: "2025年（速報集計）",
      cycle: "5年ごと",
      next: NEXT_UPDATE.population,
    },
    {
      label: "待機児童数",
      source: "こども家庭庁 保育所等関連状況取りまとめ",
      asOf: formatAsOfJa(m.waitlistChildren.asOf),
      cycle: "年1回（4月1日時点・夏〜秋公表）",
      next: NEXT_UPDATE.waitlist,
    },
    {
      label: "保育所等の定員・利用児童数",
      source: "こども家庭庁 保育所等関連状況取りまとめ（定員・申込者の状況）",
      asOf: formatAsOfJa(m.childcare?.asOf ?? m.waitlistChildren.asOf),
      cycle: "年1回（4月1日時点・夏〜秋公表）",
      next: NEXT_UPDATE.childcare,
    },
    {
      label: "財政力指数",
      source: "総務省 地方公共団体の主要財政指標一覧",
      asOf: m.fiscal?.asOf ?? "-",
      cycle: "年1回（3か年平均）",
      next: NEXT_UPDATE.fiscal,
    },
    {
      label: "在留外国人数・比率",
      source: "出入国在留管理庁 在留外国人統計（e-Stat）",
      asOf: formatAsOfJa(m.foreignResidents.asOf),
      cycle: "年2回（6月末・12月末時点）",
      next: NEXT_UPDATE.foreign,
    },
    {
      label: "災害リスク（浸水・土砂・津波・高潮・液状化）",
      source: "国土数値情報（不動産情報ライブラリ経由）",
      asOf: formatAsOfJa(m.hazard.asOf),
      cycle: "四半期ごとに再取得（出典の更新は随時）",
    },
    {
      label: "生活インフラ（駅・保育/幼稚園・医療機関）",
      source: "国土数値情報 S12・不動産情報ライブラリ・厚生労働省 医療施設調査",
      asOf: m.amenities?.asOf ?? "-",
      cycle: "年1回（駅・医療）／四半期（保育）",
    },
    {
      label: "指定緊急避難場所",
      source: "国土地理院 指定緊急避難場所データ",
      asOf: formatAsOfJa(m.shelters?.asOf ?? "-"),
      cycle: "年1回（出典の更新は随時）",
    },
  ];
}

export default async function AboutPage() {
  const rows = await loadRows();

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: `${SITE.name}について`, item: absoluteUrl(PATH) },
        ],
      },
      {
        "@type": "AboutPage",
        name: TITLE,
        url: absoluteUrl(PATH),
        description: DESC,
        about: { "@type": "WebSite", name: SITE.name, url: SITE.baseUrl },
      },
    ],
  };

  return (
    <PageShell width="narrow" trail={[{ name: SITE.name, href: "/" }, { name: "このサイトについて" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />


      <header className="detail-hero">
        <h1 className="detail-title">{SITE.name}について</h1>
        <p className="detail-lead">
          {SITE.name}は、全国47都道府県・1,918エリア（市区町村と政令指定都市の行政区）の住みやすさ関連データ（家賃・地価・人口・子育て・災害リスク・生活インフラ・在留外国人）を、地図とランキングで比較できる無料のWebサービスです。
        </p>
      </header>

      <section className="detail-section">
        <h2 className="detail-h2">データの方針（推計値を使いません）</h2>
        <p className="detail-p">
          掲載する数値はすべて政府統計・公的機関の公表データ（実データ）です。<strong>推計値・補完値は一切使用しません。</strong>出典にデータが無い自治体は、それらしい数値で埋めるのではなく「データなし」「対象外」「非公表」と明示します（例: 住宅統計の集計対象外の小規模町村、地価公示の標準地が無い自治体、北方領土6村など）。
        </p>
        <p className="detail-p">
          各指標には基準時点（出典の調査年月）を必ず併記し、出典の公表サイクルに合わせて更新しています。方針として、同じ指標が複数の公的ソースから得られる場合は、基準時点がより新しいソースを優先します。なお、治安・犯罪に関するデータは扱いません。
        </p>
        <p className="detail-p">
          ここでいう「推計値を使わない」とは、<strong>欠損を推計や補完で埋めない</strong>という意味です。一部の指標は、公表データから機械的に集計・算出した二次算出値です（家賃・地価・外国人住民比率・人口密度）。算出方法は次のセクションに明記しています。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">データの出典・基準時点・更新予定</h2>
        <div className="pref-table-wrap">
          <table className="pref-table">
            <thead>
              <tr>
                <th scope="col">指標</th>
                <th scope="col">出典</th>
                <th scope="col">基準時点</th>
                <th scope="col">更新サイクル</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.source}</td>
                  <td>{r.asOf}</td>
                  <td>{r.cycle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="h3 detail-h3">次回の更新予定</h3>
        <ul className="detail-p" style={{ paddingLeft: "1.2em" }}>
          <li>在留外国人: {NEXT_UPDATE.foreign}</li>
          <li>人口: {NEXT_UPDATE.population}</li>
          <li>待機児童: {NEXT_UPDATE.waitlist}</li>
          <li>地価: {NEXT_UPDATE.landPrice}</li>
          <li>家賃: {NEXT_UPDATE.rent}</li>
        </ul>
        <p className="detail-p detail-p-muted">
          このほか、検索サジェスト（自治体の読み仮名・町丁名からの検索）には Geolonia
          住所データ（国土交通省「位置参照情報」等を元に作成・MIT
          License）を使用しています。これは検索用のメタデータであり、掲載する統計値には使用していません。
        </p>
      </section>

      <section className="detail-section" id="calc">
        <h2 className="detail-h2">指標の算出方法</h2>
        <p className="detail-p">
          出典の公表値をそのまま掲載している指標（人口・待機児童数・在留外国人数・空き家率など）のほかに、公表データから機械的に算出している指標があります。算出方法は以下のとおりです。
        </p>
        <ul className="detail-p" style={{ paddingLeft: "1.2em" }}>
          <li>
            <strong>家賃（民営借家の平均）</strong>：住宅・土地統計調査（e-Stat 表番号 0004021470）の「家賃階級別の借家数」から、各階級の中点（5千円／1.5万円／3万円／5万円／7万円／9万円／12.5万円／17.5万円／22万円）を重みとして加重平均した<strong>KurashiMap の算出値</strong>です（最上位の「20万円以上」は開いた階級のため22万円として扱っています）。中央値ではありません。同調査は市・区および人口1万5千人以上の町村が結果の提供対象のため、それ以外の町村は「データなし」としています。
          </li>
          <li>
            <strong>地価（住宅地平均）</strong>：地価公示（国土数値情報 L01）の住宅地の標準地価格を、自治体ごとに単純平均した値です（標準地が無い自治体は都道府県地価調査 L02 で補完し、それも無ければ「対象外」）。標準地の公示価格であり、実際の取引価格ではありません。
          </li>
          <li>
            <strong>外国人住民比率</strong>：在留外国人数 ÷ 人口（国勢調査）。比率はデータに保存せず、表示時に人口と突き合わせて算出しています（人口更新との不整合を防ぐため）。
          </li>
          <li>
            <strong>人口密度</strong>：人口 ÷ 面積（国土地理院「全国都道府県市区町村別面積調」）。こちらも表示時に算出しています。
          </li>
          <li>
            <strong>保育の定員余裕率</strong>：（保育所等の定員 − 利用児童数）÷ 定員。定員・利用児童数はこども家庭庁の公表実数で、比率はデータに保存せず表示時に算出しています。政令指定都市は市単位の集計です（区のページには市全体の値をその旨を明記して表示）。負の値は定員を超えた受け入れ（定員の弾力運用）を示します。
          </li>
          <li>
            <strong>災害リスク</strong>：表示している浸水深・土砂災害区分などは、<strong>その自治体の区域内で確認された最大の区分</strong>です。{HAZARD_MAX_LEVEL_DISCLAIMER}
          </li>
        </ul>
      </section>

      <section className="detail-section" id="units">
        <h2 className="detail-h2">集計の単位（1,918エリアと全国順位の母集団）</h2>
        <p className="detail-p">
          {SITE.name}が収録しているのは<strong>1,918エリア</strong>です。内訳は市区町村1,741（市・町・村・東京23区）＋北方領土6村＋政令指定都市の行政区171で、地図・検索・自治体ページはこの単位で提供しています。
        </p>
        <p className="detail-p">
          一方、<strong>全国ランキング・全国平均・全国順位の母集団は1,747自治体</strong>です。政令指定都市の行政区は親市と数値が二重に計上されるため、集計から除外しています（東京23区は市町村と同格の基礎自治体なので含みます）。行政区のページに全国順位が表示されないのはこのためです。
        </p>
      </section>

      <section className="detail-section" id="score">
        <h2 className="detail-h2">「住みやすさ総合スコア」の算出方法</h2>
        <p className="detail-p">
          各自治体ページの「住みやすさ総合スコア」は、収録済みの実データだけを入力とする決定論的な計算です（AI・LLM による生成は行っていません）。次の5軸をそれぞれ1〜5の星で評価し、その平均を20倍して0〜100点に換算しています。
        </p>
        <ul className="detail-p" style={{ paddingLeft: "1.2em" }}>
          <li><strong>アクセス</strong>：自治体内の駅数（30／15／5／1駅を境に5〜2、0駅で1）</li>
          <li><strong>家賃</strong>：民営借家の家賃平均（5万／5.5万／6万／6.5万円を境に、安いほど高評価）</li>
          <li><strong>子育て</strong>：待機児童数（0人で5、10人未満で4、50人未満で3、200人未満で2、それ以上で1）</li>
          <li><strong>災害</strong>：浸水想定の深さ・土砂災害区域・液状化・津波・高潮の該当状況に応じて5から減点</li>
          <li><strong>生活インフラ</strong>：医療機関数と保育・幼稚園等の施設数（それぞれ80／40／15／5件を境に評価し平均）</li>
        </ul>
        <p className="detail-p">
          <strong>データが「対象外」「非公表」の指標は、母数から除外して計算します</strong>（欠損を0点や推計値で埋めることはしません）。そのため各ページには「実データの◯/5指標から算出した目安です」と算出に使えた軸数を必ず併記しています。5軸すべてが対象外の場合はスコアを表示しません。
        </p>
        <p className="detail-p">
          このスコアは<strong>自治体の優劣を決めるものではなく、指標の傾向をつかむための目安</strong>です。アクセス・生活インフラの軸は施設の実数を使うため、規模の大きい自治体ほど高く出る傾向があります。また、治安・犯罪に関するデータは扱わない方針のため、軸に含めていません。しきい値は固定で、上記のとおり公開しています。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">「この自治体の特徴」の算出方法</h2>
        <p className="detail-p">
          各自治体ページの「特徴」欄は、収録済みの実データだけを使って機械的に抽出しています。家賃・地価は全国平均との相対差、人口増減率・空き家率・外国人住民比率は全国平均とのポイント差、人口・人口密度は全国順位のパーセンタイルをそれぞれスコア化し、差が一定のしきい値を超えた指標を最大5件表示します。差が小さい指標は表示しません。
        </p>
        <p className="detail-p">
          この「特徴」欄の表示は「全国平均より◯%低い」「全国◯位」のような客観的な比較にとどめ、<strong>この欄では数値の良し悪しの評価（住みやすい・おすすめ等）は行いません</strong>（総合的な目安は上記の「住みやすさ総合スコア」で、別の機能として算出方法を公開しています）。平均はいずれも有効値を持つ自治体のみで算出し、欠損を推計で埋めることはありません（外国人住民比率の全国平均のみ人口加重平均、それ以外は自治体を1票とする単純平均）。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">免責事項</h2>
        <p className="detail-p detail-p-muted">
          本サイトの情報は、住まい選びの参考情報として公的統計を整理・可視化したものであり、内容の完全性・正確性・最新性を保証するものではありません。統計の基準時点以降に状況が変わっている場合があります。重要な判断（契約・購入など）の際は、必ず各自治体・出典元の一次情報をご確認ください。本サイトの利用により生じた損害について、運営者は責任を負いかねます。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">運営</h2>
        <p className="detail-p">
          {SITE.name}は個人が運営する無料の情報サービスです。データの誤りにお気づきの場合は、該当ページと出典をあわせてご指摘いただければ、一次情報を確認のうえ速やかに修正します。
        </p>
      </section>

      <div className="detail-footnav">
        <Link href="/map" className="detail-back">地図で見る</Link>
        <Link href="/ranking" className="detail-back">ランキング一覧</Link>
        <Link href="/privacy" className="detail-back">プライバシーポリシー</Link>
      </div>
    </PageShell>
  );
}
