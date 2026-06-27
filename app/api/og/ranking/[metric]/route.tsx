import { ImageResponse } from "next/og";
import { getRankingBySlug } from "@/lib/rankings";
import { OgFrame, OgHeading, Pill, OG_SIZE } from "@/lib/og";

// next/og の Edge ランタイムは本体だけで Edge Function サイズ上限(4.02MB)に肉薄するため、
// lib インポートを足す本ルートは超過する。他の OG ルートと揃えて Node ランタイムにする。
export const runtime = "nodejs";

// ランキングOG。全国集計はデータ全量ロードになり重いため、画像は
// タイトル中心の意匠とし、1位などの動的値は載せない。
export function GET(_req: Request, { params }: { params: { metric: string } }) {
  const def = getRankingBySlug(params.metric);
  if (!def) return new Response("not found", { status: 404 });

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
          <Pill>{def.columnLabel}で比較</Pill>
          <Pill>全国の市区町村</Pill>
        </div>
      </OgFrame>
    ),
    OG_SIZE,
  );
}
