// 国土地理院タイルの同一originプロキシ。
// GSI は CORS ヘッダを返さないため、MapLibre が WebGL テクスチャ化できない。
// 自ドメイン経由で配信すれば same-origin 扱いで描画できる。
import { NextResponse } from "next/server";

export const runtime = "edge";

const STYLE = "pale"; // 国土地理院 淡色地図

export async function GET(
  _req: Request,
  props: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const params = await props.params;
  const { z, x, y } = params;
  if (!/^\d{1,2}$/.test(z) || !/^\d{1,7}$/.test(x) || !/^\d{1,7}$/.test(y)) {
    return new NextResponse("invalid params", { status: 400 });
  }
  const upstream = `https://cyberjapandata.gsi.go.jp/xyz/${STYLE}/${z}/${x}/${y}.png`;
  const r = await fetch(upstream, { cache: "force-cache" });
  if (!r.ok) {
    return new NextResponse(null, { status: r.status });
  }
  return new NextResponse(r.body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
