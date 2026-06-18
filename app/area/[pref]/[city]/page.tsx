import Link from "next/link";
import { getMunicipality, listMunicipalities } from "@/lib/metrics";
import { buildSummary } from "@/lib/summary";

export async function generateStaticParams() {
  const all = await listMunicipalities("saitama");
  return all.map((m) => ({ pref: m.pref, city: m.code }));
}

export default async function AreaPage({
  params,
}: {
  params: { pref: string; city: string };
}) {
  const m = await getMunicipality(params.city);
  if (!m) {
    return (
      <div className="detail-root">
        <p>該当する自治体が見つかりません。</p>
        <Link href="/" className="detail-back">← 地図に戻る</Link>
      </div>
    );
  }

  const rows: { label: string; value: string; source?: string; asOf?: string; est?: boolean }[] = [
    { label: "人口", value: `${m.population.toLocaleString()} 人（${m.populationTrend}）` },
    { label: "家賃中央値", value: `${m.rent.value.toLocaleString()} ${m.rent.unit}`, source: m.rent.source, asOf: m.rent.asOf, est: m.rent.isEstimated },
    { label: "地価", value: `${m.landPrice.value.toLocaleString()} ${m.landPrice.unit}`, source: m.landPrice.source, asOf: m.landPrice.asOf, est: m.landPrice.isEstimated },
    { label: "待機児童", value: `${m.waitlistChildren.value} ${m.waitlistChildren.unit}`, source: m.waitlistChildren.source, asOf: m.waitlistChildren.asOf, est: m.waitlistChildren.isEstimated },
    { label: "災害リスク", value: `${m.hazard.hasFloodRisk ? "浸水想定あり" : "浸水想定なし"} / ${m.hazard.hasLandslideRisk ? "土砂災害あり" : "土砂災害なし"}`, source: m.hazard.source, asOf: m.hazard.asOf },
  ];

  return (
    <div className="detail-root">
      <Link href="/" className="detail-back">← 地図に戻る</Link>
      <h1 className="detail-title">{m.name}</h1>
      <p className="detail-lead">{buildSummary(m)}</p>
      <table className="detail-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>
                {r.value}
                {r.est && <span className="metric-est">推計</span>}
                {r.source && (
                  <div className="detail-source">
                    出典: {r.source}（{r.asOf}）
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {m.hazard.note && (
        <p className="detail-note">災害メモ: {m.hazard.note}</p>
      )}
    </div>
  );
}
