import { buildFurusatoChoices } from "@/lib/furusatoChoices";
import { furusatoLink } from "@/lib/monetization";
import { FURUNAVI_TOP_PAGE_URL } from "@/lib/furunaviMunicipals";
import type { Municipality } from "@/lib/types";
import FurusatoPicker from "./FurusatoPicker";
import { FurusatoBand } from "./FurusatoBand";

export default async function FurusatoRankingEntry({ candidates, pagePath }: { candidates: Municipality[]; pagePath: string }) {
  const fallback = furusatoLink(FURUNAVI_TOP_PAGE_URL, "portal");
  if (!fallback) return null;
  const choices = await buildFurusatoChoices(candidates);
  if (!choices.length) return <FurusatoBand />;
  return <FurusatoPicker key={pagePath} choices={choices} fallback={fallback} />;
}
