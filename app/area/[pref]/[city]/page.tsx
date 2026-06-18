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
      <div style={{ padding: 24 }}>
        <p>該当する自治体が見つかりません。</p>
        <Link href="/">← 地図に戻る</Link>
      </div>
    );
  }

  const rows = [
    { label: "人口", value: `${m.population.toLocaleString()} 人（${m.populationTrend}）` },
    { label: "家賃中央値", value: `${m.rent.value.toLocaleString()} ${m.rent.unit}`, source: m.rent.source, asOf: m.rent.asOf, est: m.rent.isEstimated },
    { label: "地価", value: `${m.landPrice.value.toLocaleString()} ${m.landPrice.unit}`, source: m.landPrice.source, asOf: m.landPrice.asOf, est: m.landPrice.isEstimated },
    { label: "待機児童", value: `${m.waitlistChildren.value} ${m.waitlistChildren.unit}`, source: m.waitlistChildren.source, asOf: m.waitlistChildren.asOf, est: m.waitlistChildren.isEstimated },
    { label: "災害リスク", value: `${m.hazard.hasFloodRisk ? "浸水想定あり" : "浸水想定なし"} / ${m.hazard.hasLandslideRisk ? "土砂災害あり" : "土砂災害なし"}`, source: m.hazard.source, asOf: m.hazard.asOf },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <Link href="/">← 地図に戻る</Link>
      <h1 style={{ marginTop: 12 }}>{m.name}</h1>
      <p style={{ color: "#555" }}>{buildSummary(m)}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderBottom: "1px solid #e5e9ee" }}>
              <th style={{ textAlign: "left", padding: "10px 8px", width: 140, color: "#444" }}>{r.label}</th>
              <td style={{ padding: "10px 8px" }}>
                {r.value}
                {"est" in r && r.est && <span style={{ marginLeft: 8, fontSize: 12, color: "#a07000" }}>※推計</span>}
                {"source" in r && r.source && (
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    出典: {r.source}（{r.asOf}）
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {m.hazard.note && (
        <p style={{ marginTop: 12, fontSize: 14, color: "#555" }}>
          災害メモ: {m.hazard.note}
        </p>
      )}
    </div>
  );
}
