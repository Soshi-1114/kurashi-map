import { ImageResponse } from "next/og";
import { getRankingBySlug } from "@/lib/rankings";
import { getMunicipality } from "@/lib/metrics";
import { OgFrame, OgHeading, Pill, OG_SIZE } from "@/lib/og";

// next/og の Edge ランタイムは本体だけで Edge Function サイズ上限(4.02MB)に肉薄するため、
// lib インポートを足す本ルートは超過する。他の OG ルートと揃えて Node ランタイムにする。
export const runtime = "nodejs";

// ランキングOG。全国集計はデータ全量ロードになり重いため、画像は
// タイトル中心の意匠とし、1位などの動的値は載せない。
export async function GET(_req: Request, props: { params: Promise<{ metric: string }> }) {
  const params = await props.params;
  const def = getRankingBySlug(params.metric);
  if (!def) return new Response("not found", { status: 404 });

  // 鮮度ラベル（例「2025年6月最新」）。asOf は全自治体で同一期なので、全量ロードせず
  // サンプル1自治体（さいたま市=1県ぶんのロード）から導出する。
  const sample = await getMunicipality("11100");
  const freshness = def.freshnessLabel?.(sample ?? null) ?? null;

  return new ImageResponse(
    (
      <OgFrame>
        <OgHeading
          eyebrow="全国ランキング"
          title={def.title}
          sub="政府統計の実データで市区町村を比較"
          titleSize={64}
        />
        <div style={{ marginTop: "auto", display: "flex", gap: 16 }}>
          {freshness && <Pill>{freshness}</Pill>}
          <Pill>{def.columnLabel}で比較</Pill>
          <Pill>全国の市区町村</Pill>
        </div>
      </OgFrame>
    ),
    OG_SIZE,
  );
}
