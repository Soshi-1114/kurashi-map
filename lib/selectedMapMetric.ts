import type { Municipality } from "./types";
import type { MapMetricKey } from "./mapMetrics";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { hasForeignRatio, foreignRatioPct } from "./foreignResidents";
import { hasVacancy } from "./vacancy";
import { elderlyRatioPct } from "./ageStats";
import { futureChangeRate2050 } from "./futurePopulation";
import { formatAsOfJa, signedPct } from "./format";

/** The same municipality value the current map color represents, with its reference date. */
export function selectedMapMetric(m: Municipality, key: MapMetricKey | "none") {
  switch (key) {
    case "rent":
      return { label: "民営借家の家賃平均", value: hasRent(m.rent.value) ? `${m.rent.value.toLocaleString()} 円/月` : "データなし", note: `${formatAsOfJa(m.rent.asOf)}・住宅・土地統計調査の階級別集計から算出` };
    case "landPrice":
      return { label: "住宅地の地価", value: hasLandPrice(m.landPrice.value) ? `${m.landPrice.value.toLocaleString()} 円/㎡` : "対象外", note: `${formatAsOfJa(m.landPrice.asOf)}・地価公示` };
    case "populationTrend":
      return { label: "人口トレンド", value: `${m.populationTrend}${typeof m.populationChangeRate === "number" ? `（${signedPct(m.populationChangeRate)}%）` : ""}`, note: "2020→2025年・国勢調査" };
    case "foreignRatio": {
      const ratio = foreignRatioPct(m);
      return { label: "外国人住民の割合", value: hasForeignRatio(ratio) ? `${ratio.toFixed(2)}%` : "対象外", note: `${formatAsOfJa(m.foreignResidents.asOf)}・在留外国人統計` };
    }
    case "vacancy":
      return { label: "空き家率", value: hasVacancy(m.vacancy) ? `${m.vacancy.rate.toFixed(1)}%` : "対象外", note: m.vacancy ? `${formatAsOfJa(m.vacancy.asOf)}・住宅・土地統計調査` : "住宅・土地統計調査の集計対象外" };
    case "aging": {
      const rate = elderlyRatioPct(m.ageStats);
      return { label: "高齢化率", value: rate == null ? "データなし" : `${rate.toFixed(1)}%`, note: m.ageStats ? `${formatAsOfJa(m.ageStats.asOf)}・住民基本台帳` : "住民基本台帳の対象データなし" };
    }
    case "futurePopulation": {
      const rate = futureChangeRate2050(m.futurePopulation);
      return { label: "2050年の人口増減率", value: rate == null ? "対象外" : `${signedPct(rate)}%`, note: "2020年比・国立社会保障・人口問題研究所の公的推計" };
    }
    case "none":
      return { label: "人口", value: `${m.population.toLocaleString()} 人`, note: "2025年・国勢調査" };
  }
}
