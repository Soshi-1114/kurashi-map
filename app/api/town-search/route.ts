// 町丁名（大字・町丁目）→ 自治体のサジェスト検索。検索コンボボックスが
// 入力2文字以上でデバウンス付きで呼ぶ。町丁データ（約4MB）をクライアントに
// 配らないためのサーバー側エンドポイント（/api/muni と同じ2段階配信方針）。
import { NextResponse } from "next/server";
import { searchTowns, TOWN_QUERY_MIN } from "@/lib/townSearch";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  // 短すぎ・長すぎるクエリは検索せず空で返す（後者は無意味な全走査の抑止）
  if (q.length < TOWN_QUERY_MIN || q.length > 50) {
    return NextResponse.json({ towns: [] });
  }
  const towns = await searchTowns(q, 8);
  // 町丁データはデータ更新→再デプロイ時のみ変わる。/api/muni と同方針でキャッシュする
  // （クエリごとに URL が異なるので CDN はクエリ単位でキャッシュする）。
  return NextResponse.json(
    { towns },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
