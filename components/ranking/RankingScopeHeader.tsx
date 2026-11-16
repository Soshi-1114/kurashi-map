"use client";
import RankingTitle from "./RankingTitle";
import { useRankingScope } from "@/lib/useRankingScope";
import { rankingScopeLabel } from "@/lib/rankingScope";

export default function RankingScopeHeader({ title, lead }: { title: string; lead: string }) {
  const scope = useRankingScope();
  const regional = scope.startsWith("region:");
  const label = rankingScopeLabel(scope);
  return <>
    <RankingTitle title={regional ? `${label}の${title.replace(/^全国の/, "")}` : title} />
    <p className="rk-lead rk-scope-lead">{regional ? `${label}の市区町村を比較できます。地域や指標を変えて調べられます。` : lead}</p>
  </>;
}
