import { DENKI_AREA_LABELS, areaForMuni } from "@/lib/denki";
import { DENKI_PLANS } from "@/lib/denkiPlans";
import { HOUSEHOLD_KWH, HOUSEHOLD_SIZES, defaultAmpere, estimateMonthly } from "@/lib/denkiSim";
import DenkiQuickEntry, { type QuickDenkiArea } from "@/components/denki/DenkiQuickEntry";

/** 全プランJSONはサーバーだけで使い、入口には人数別の基準額だけを渡す。 */
export function DenkiTeaser({ municipalityCode, municipalityName }: { municipalityCode: string; municipalityName: string }) {
  const resolved = areaForMuni(municipalityCode);
  if (!resolved) return null;
  const areas: QuickDenkiArea[] = [resolved.area, ...(resolved.altArea ? [resolved.altArea] : [])].flatMap(area => {
    const pricing = DENKI_PLANS.plans.find(p => p.kind === "baseline" && p.areas[area])?.areas[area];
    return pricing ? [{ area, label: DENKI_AREA_LABELS[area], estimates: HOUSEHOLD_SIZES.map(people => ({ people, kwh: HOUSEHOLD_KWH[people], ampere: pricing.basic.type === "ampere" ? defaultAmpere(people) : null, yen: estimateMonthly(pricing, HOUSEHOLD_KWH[people], defaultAmpere(people)) })) }] : [];
  });
  if (!areas.length) return null;
  return <DenkiQuickEntry key={municipalityCode} code={municipalityCode} name={municipalityName} areas={areas} note={resolved.note} asOf={DENKI_PLANS.asOf} />;
}
