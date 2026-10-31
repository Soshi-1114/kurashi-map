import { getMunicipality } from "./metrics";
import { furunaviMunicipalPageUrl } from "./furunaviMunicipals";
import { furusatoLink, type FurusatoLinkInfo } from "./monetization";
import { prefNameOf } from "./site";
import type { Municipality } from "./types";

export type FurusatoChoice = { code: string; name: string; label: string; link: FurusatoLinkInfo };
type Candidate = Pick<Municipality, "code" | "name" | "pref" | "level" | "parentCode">;
/** 表示済みの先頭10自治体だけを候補にし、行政区は寄付先の親市へ解決する。サーバー専用。 */
export async function buildFurusatoChoices(candidates: Candidate[], resolveLink = furusatoLink, resolveParent = getMunicipality): Promise<FurusatoChoice[]> {
  const resolved = await Promise.all(candidates.slice(0, 10).map(async m => {
    const donee = m.level === "ward" ? (m.parentCode ? await resolveParent(m.parentCode) : null) : m;
    if (!donee) return null;
    const link = resolveLink(furunaviMunicipalPageUrl(donee.code));
    return link?.kind === "municipal" ? { code: donee.code, name: donee.name, label: `${prefNameOf(donee.pref)} ${donee.name}`, link } : null;
  }));
  const seen = new Set<string>();
  return resolved.filter((choice): choice is FurusatoChoice => {
    if (!choice || seen.has(choice.code)) return false;
    seen.add(choice.code);
    return true;
  });
}
