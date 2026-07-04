// 詳細ページの「データで見る」解説文を自治体データから生成する。
//
// 狙い（SEO）: 全自治体ページで共通テンプレの比率が高いと Google の「クロール済み-
// インデックス未登録」に入りやすい。そこで、自治体ごとに必ず値が変わる「相対比較」
// （県平均との乖離・全国順位・全国平均との対比）を文章化し、ページ固有の可視テキスト
// を増やして重複扱いを避ける。buildOverview（軸スコアのしきい値ベース）とは補完関係。
//
// テンプレ感を下げるため、指標ごとに構造の異なる「文型」を複数持ち、自治体コードから
// 決定的に1つ選ぶ（pickVariant）。同じ指標でも自治体ごとに語順・言い回しが変わる。
// 文型バンクは外部（ChatGPT）で下書きし、日本語の文法が全ケースで成立するよう補正した:
//   - 家賃の比較句は {cmp}（「を{adv}下回る水準」/「とほぼ同水準」）に統一。連用/連体の
//     混在と「ほぼ同水準」時の助詞破綻を避ける。
//   - 外国人 #1 は「全国平均を{band}」→「全国平均と比べて{band}」（band=同程度 の非文回避）。
//
// honesty 方針: すべて実データ由来。値のない指標・比較材料のない指標には一切言及しない。
// 平均・順位は既存の集計レイヤー（areaStats/rankingStats/foreignStats）を再利用する。
//
// シグネチャは将来 LLM 生成へ差し替え可能な形を保つ（buildSummary / buildOverview と同方針）。

import type { Municipality } from "./types";
import type { AreaStats } from "./areaStats";
import type { RankPos } from "./rankingStats";
import type { ForeignComparison } from "./foreignStats";
import { avgBand } from "./foreignStats";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { isWaitlistDisclosed } from "./waitlist";

// 乖離の大きさの境界（%）。この未満は「ほぼ同水準」、DEV_LARGE 以上は「大きく」。
const DEV_SLIGHT = 3;
const DEV_MODERATE = 10;
const DEV_LARGE = 20;

export type InsightContext = {
  prefName: string;
  areaStats: AreaStats;
  rankPositions: Map<string, Map<string, RankPos>>;
  fc: ForeignComparison | null;
};

// ---- 文型バンク（ChatGPT 下書き＋文法補正）。{placeholder} をデータで差し替える ----
const TEMPLATES = {
  // {cmp}=「を{adv}下回る水準」等の比較句。{tier}=安さの分位表現。
  rent: [
    "{name}の家賃中央値は{value}円/月で、{pref}平均（{prefAvg}円）{cmp}、{tier}です（全国の安い順で{rank}位/{total}）。",
    "全国の家賃が安い順で{rank}位/{total}の{name}は、中央値が{value}円/月で、{pref}平均{cmp}です。",
    "{tier}に位置する{name}の家賃中央値は{value}円/月で、{pref}平均（{prefAvg}円）{cmp}となっています。",
    "{value}円/月が{name}の家賃中央値です。{pref}平均{cmp}で、全国順位は{rank}位/{total}となっています。",
    "{name}では家賃中央値が{value}円/月となっており、{pref}平均（{prefAvg}円）{cmp}、{tier}に分類されます。",
    "家賃中央値は{value}円/月です。{name}は{pref}平均{cmp}で、全国の安い順では{rank}位/{total}に位置します。",
  ],
  land: [
    "{name}の公示地価は{value}円/㎡で、全国順位は{rank}位/{total}、{tier}です。",
    "{value}円/㎡が{name}の公示地価です。{tier}にあたり、順位は{rank}位/{total}となっています。",
    "{tier}に分類される{name}の公示地価は{value}円/㎡で、全国順位は{rank}位/{total}です。",
    "全国順位は{rank}位/{total}です。{name}の公示地価は{value}円/㎡で、{tier}となっています。",
    "{name}では公示地価が{value}円/㎡となっており、{tier}にあたります（{rank}位/{total}）。",
    "公示地価は{value}円/㎡です。{name}は全国順位{rank}位/{total}で、{tier}に該当します。",
  ],
  cost: [
    "{name}では家賃中央値が{rentValue}円/月、公示地価が{landValue}円/㎡で、いずれも県平均より{sideword}です。",
    "家賃中央値は{rentValue}円/月、公示地価は{landValue}円/㎡です。{name}はいずれも県平均より{sideword}となっています。",
    "{rentValue}円/月の家賃中央値と{landValue}円/㎡の公示地価を持つ{name}は、両指標とも県平均より{sideword}です。",
    "{name}の家賃中央値は{rentValue}円/月、公示地価は{landValue}円/㎡で、家賃・地価とも県平均より{sideword}です。",
    "家賃中央値{rentValue}円/月、公示地価{landValue}円/㎡が{name}の水準で、両指標とも県平均より{sideword}となっています。",
    "{name}では家賃中央値と公示地価がそれぞれ{rentValue}円/月、{landValue}円/㎡となっており、どちらも県平均より{sideword}です。",
  ],
  population: [
    "{name}の人口は{value}人で、{tier}です。直近の動向は{trend}となっています。",
    "{value}人が{name}の人口です。{tier}に分類され、人口動向は{trend}です。",
    "{tier}にあたる{name}の人口は{value}人で、直近では{trend}となっています。",
    "人口は{value}人です。{name}は{tier}にあたり、直近の推移は{trend}です。",
    "{name}では人口が{value}人となっており、{tier}に分類されます。人口動向は{trend}です。",
    "{value}人の人口を持つ{name}は{tier}で、直近の人口推移は{trend}となっています。",
  ],
  waitlist_zero: [
    "{name}では待機児童数は0人です。",
    "待機児童数は0人で、{name}では待機児童は確認されていません。",
    "{name}の待機児童数は0人となっています。",
    "公表値では、{name}の待機児童数は0人です。",
    "{name}では待機児童が0人となっています。",
    "待機児童数は0人です。{name}では待機児童は発生していません。",
  ],
  waitlist_some: [
    "{name}の待機児童数は{value}人です。",
    "待機児童数は{name}で{value}人となっています。",
    "{value}人が{name}の待機児童数として公表されています。",
    "{name}では待機児童数が{value}人となっています。",
    "公表値では、{name}の待機児童数は{value}人です。",
    "待機児童数は{value}人です。{name}では待機児童が確認されています。",
  ],
  foreign: [
    "{name}の外国人住民比率は{ratio}%で、全国平均と比べて{band}、{tier}です（全国順位{rank}位/{total}）。",
    "{ratio}%が{name}の外国人住民比率です。全国平均と比べると{band}で、{tier}に位置します。",
    "{tier}に分類される{name}の外国人住民比率は{ratio}%で、全国順位は{rank}位/{total}です。",
    "全国順位{rank}位/{total}の{name}では、外国人住民比率は{ratio}%で、全国平均と比べて{band}です。",
    "{name}では外国人住民比率が{ratio}%となっており、全国平均との比較では{band}、{tier}です。",
    "外国人住民比率は{ratio}%です。{name}は全国平均と比べて{band}で、{tier}に位置します。",
  ],
} as const;

// 各指標の順位分位（tierOf）→ 位置づけ表現。
// いずれも名詞句（末尾「水準/自治体/都市」）に統一。文型側の「〜です／〜に位置／〜に分類
// ／〜にあたり」いずれの接続でも成立させるため（形容詞止めの語尾破綻を避ける）。
const RENT_TIER: Record<Tier, string> = {
  top: "全国有数の割安な水準",
  high: "全国的にも割安な水準",
  mid: "全国平均並みの水準",
  low: "全国的にはやや高めの水準",
  bottom: "全国的には高めの水準",
};
const LAND_TIER: Record<Tier, string> = {
  top: "全国有数の高値の水準",
  high: "全国的にも高めの水準",
  mid: "全国平均並みの水準",
  low: "全国的にはやや控えめな水準",
  bottom: "全国的には控えめな水準",
};
const POP_TIER: Record<Tier, string> = {
  top: "全国有数の規模の都市",
  high: "全国的にも規模の大きい自治体",
  mid: "中規模の自治体",
  low: "小規模な自治体",
  bottom: "小規模な自治体",
};
const FOREIGN_TIER: Record<Tier, string> = {
  top: "全国でも比率が高い水準",
  high: "全国的にも比率が高めの水準",
  mid: "全国平均並みの水準",
  low: "全国的には比率が低めの水準",
  bottom: "全国でも比率が低い水準",
};

type Tier = "top" | "high" | "mid" | "low" | "bottom";

type Deviation = { same: boolean; pct: number; adv: string; below: boolean };

// 値 v の平均 avg に対する乖離を段階化する。avg が 0 以下なら比較不能（null）。
function deviation(v: number, avg: number): Deviation | null {
  if (avg <= 0) return null;
  const pct = Math.round(((v - avg) / avg) * 100);
  const a = Math.abs(pct);
  if (a < DEV_SLIGHT) return { same: true, pct, adv: "", below: pct < 0 };
  const adv = a >= DEV_LARGE ? "大きく" : a < DEV_MODERATE ? "やや" : "";
  return { same: false, pct, adv, below: pct < 0 };
}

// 家賃の比較句。「を{adv}下回る水準」/「を上回る水準」/「とほぼ同水準」。
// dev が null（県平均なし）なら比較句なしで空文字。
function cmpPhrase(dev: Deviation | null): string {
  if (!dev) return "とほぼ同水準"; // 平均不明時は中立に倒す（呼び出し側で prefAvg も出さない）
  if (dev.same) return "とほぼ同水準";
  return `を${dev.adv}${dev.below ? "下回る" : "上回る"}水準`;
}

function tierOf(rank: number, total: number): Tier {
  if (total <= 0) return "mid";
  const p = rank / total;
  if (p <= 0.1) return "top";
  if (p <= 1 / 3) return "high";
  if (p >= 0.9) return "bottom";
  if (p >= 2 / 3) return "low";
  return "mid";
}

function pos(ctx: InsightContext, slug: string, code: string): RankPos | null {
  return ctx.rankPositions.get(slug)?.get(code) ?? null;
}

// 自治体コード（+指標名で salt）から決定的に文型を選ぶ。ビルド間で安定・自治体間で分散。
function pickVariant<T>(list: readonly T[], code: string, salt: string): T {
  const key = `${code}:${salt}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

// テンプレートの {placeholder} を vars で差し替える。未提供のキーはそのまま残す（検知用）。
function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/**
 * 「データで見る{name}」用の解説文（0〜5文）。各文は他自治体との相対比較を含み、
 * 文型は自治体コードから決定的に選ばれる。比較材料のない項目はスキップする（honesty 方針）。
 */
export function buildInsights(m: Municipality, ctx: InsightContext): string[] {
  const name = m.displayName ?? m.name;
  const { prefName } = ctx;
  const code = m.code;
  const out: string[] = [];

  const rentOk = hasRent(m.rent.value);
  const landOk = hasLandPrice(m.landPrice.value);
  const rentDev = rentOk ? deviation(m.rent.value, ctx.areaStats.rent.byPref.get(m.pref) ?? 0) : null;
  const landDev = landOk ? deviation(m.landPrice.value, ctx.areaStats.landPrice.byPref.get(m.pref) ?? 0) : null;
  const rentPos = pos(ctx, "rent-cheap", m.code);
  const landPos = pos(ctx, "land-price-high", m.code);

  // 家賃と地価が「ともに県平均から同じ方向へ、はっきり振れている」なら住居コストに統合。
  const bothClearSameDir =
    rentDev && landDev && !rentDev.same && !landDev.same && rentDev.below === landDev.below;

  if (bothClearSameDir && rentDev) {
    out.push(
      fill(pickVariant(TEMPLATES.cost, code, "cost"), {
        name,
        rentValue: m.rent.value.toLocaleString(),
        landValue: m.landPrice.value.toLocaleString(),
        sideword: rentDev.below ? "抑えめ" : "高め",
      }),
    );
    const ranks: string[] = [];
    if (rentPos) ranks.push(`家賃の安さは全国${rentPos.rank.toLocaleString()}位/${rentPos.total.toLocaleString()}`);
    if (landPos) ranks.push(`地価の高さは全国${landPos.rank.toLocaleString()}位/${landPos.total.toLocaleString()}`);
    if (ranks.length > 0) out.push(`${ranks.join("、")}です。`);
  } else {
    if (rentOk && rentPos) {
      const prefAvg = ctx.areaStats.rent.byPref.get(m.pref);
      out.push(
        fill(pickVariant(TEMPLATES.rent, code, "rent"), {
          name,
          pref: prefName,
          value: m.rent.value.toLocaleString(),
          prefAvg: (prefAvg ?? 0).toLocaleString(),
          cmp: cmpPhrase(rentDev),
          tier: RENT_TIER[tierOf(rentPos.rank, rentPos.total)],
          rank: rentPos.rank.toLocaleString(),
          total: rentPos.total.toLocaleString(),
        }),
      );
    }
    if (landOk && landPos) {
      out.push(
        fill(pickVariant(TEMPLATES.land, code, "land"), {
          name,
          value: m.landPrice.value.toLocaleString(),
          tier: LAND_TIER[tierOf(landPos.rank, landPos.total)],
          rank: landPos.rank.toLocaleString(),
          total: landPos.total.toLocaleString(),
        }),
      );
    }
  }

  // 人口: 規模の分位 + トレンド（順位が取れる市区町村レベルのみ）。
  const popPos = pos(ctx, "population-most", m.code);
  if (popPos && m.population > 0) {
    out.push(
      fill(pickVariant(TEMPLATES.population, code, "pop"), {
        name,
        value: m.population.toLocaleString(),
        tier: POP_TIER[tierOf(popPos.rank, popPos.total)],
        trend: m.populationTrend,
      }),
    );
  }

  // 待機児童: ゼロ/ありで文型バンクを分ける（公表されている自治体のみ）。
  if (isWaitlistDisclosed(m.waitlistChildren)) {
    out.push(
      m.waitlistChildren.value === 0
        ? fill(pickVariant(TEMPLATES.waitlist_zero, code, "wl0"), { name })
        : fill(pickVariant(TEMPLATES.waitlist_some, code, "wl1"), {
            name,
            value: m.waitlistChildren.value.toLocaleString(),
          }),
    );
  }

  // 外国人住民比率: 全国平均との対比 + 分位（対象かつ比較可能なときのみ）。
  if (ctx.fc) {
    const fc = ctx.fc;
    const band = avgBand(fc.ratio, fc.nationalAvg);
    const fPos = pos(ctx, "foreign-ratio-high", m.code);
    out.push(
      fill(pickVariant(TEMPLATES.foreign, code, "foreign"), {
        name,
        ratio: fc.ratio.toFixed(2),
        band: band === "higher" ? "高め" : band === "lower" ? "低め" : "同程度",
        tier: fPos ? FOREIGN_TIER[tierOf(fPos.rank, fPos.total)] : FOREIGN_TIER.mid,
        rank: fc.nationalRank.toLocaleString(),
        total: fc.nationalTotal.toLocaleString(),
      }) + "多様性・国際性の目安になります。",
    );
  }

  return out;
}
