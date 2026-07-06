// 自治体コードからフル Municipality を返す。トップ地図で自治体を選択した時に
// 詳細パネル用にオンデマンド取得する（初期ページは軽量サマリのみ配信）。
import { NextResponse } from "next/server";
import { getMunicipality } from "@/lib/metrics";

export async function GET(_req: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  // 全国地方公共団体コードは5桁数字。形式不正はデータ探索に入る前に弾く。
  if (!/^\d{5}$/.test(params.code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const m = await getMunicipality(params.code);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 自治体データはビルド時に data/*.json へ固定され、更新は四半期/年次のデータ更新
  // → 再デプロイ時のみ（その時に CDN は自動パージされる）。OG 画像と同方針で長めに
  // キャッシュする（ブラウザ1日／CDN7日）。stale-while-revalidate で切替時の待ちも隠す。
  return NextResponse.json(m, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" },
  });
}
