// 駅名 → 自治体＋駅座標のサジェスト検索。検索コンボボックスが入力2文字以上で
// デバウンス付きで呼ぶ。駅データ（~400KB）をクライアントに配らないための
// サーバー側エンドポイント（/api/town-search と同じ2段階配信方針）。
import { NextResponse } from "next/server";
import { searchStations, STATION_QUERY_MIN } from "@/lib/stationSearch";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  // 短すぎ・長すぎるクエリは検索せず空で返す（後者は無意味な全走査の抑止）
  if (q.length < STATION_QUERY_MIN || q.length > 50) {
    return NextResponse.json({ stations: [] });
  }
  const stations = await searchStations(q, 6);
  // 駅データはデータ更新→再デプロイ時のみ変わる。/api/town-search と同方針でキャッシュする。
  return NextResponse.json(
    { stations },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
