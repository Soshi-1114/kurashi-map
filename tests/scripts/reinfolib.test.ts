import { describe, it, expect } from "vitest";
import * as turf from "@turf/turf";
import {
  lng2tileX,
  lat2tileY,
  tileX2lng,
  tileY2lat,
  tileBbox,
  bboxIntersects,
  tilesForPolys,
  findPolyForPoint,
  pool,
} from "../../scripts/_lib/reinfolib.mjs";

// loadMuniPolys 由来の { code, feat, bbox } を作るヘルパー（四角形ポリゴン）。
function squarePoly(code: string, [w, s, e, n]: [number, number, number, number]) {
  const feat = turf.polygon([[[w, s], [e, s], [e, n], [w, n], [w, s]]]);
  return { code, feat, bbox: [w, s, e, n] as [number, number, number, number] };
}

describe("Slippy タイル座標", () => {
  it("経度→タイルX→経度 でタイルが経度を内包する", () => {
    for (const lng of [-179, 0, 139.6917, 179]) {
      const z = 14;
      const x = lng2tileX(lng, z);
      expect(tileX2lng(x, z)).toBeLessThanOrEqual(lng);
      expect(tileX2lng(x + 1, z)).toBeGreaterThan(lng);
    }
  });

  it("緯度→タイルY→緯度 でタイルが緯度を内包する（Yは北で小）", () => {
    for (const lat of [-60, 0, 35.6895, 60]) {
      const z = 14;
      const y = lat2tileY(lat, z);
      expect(tileY2lat(y, z)).toBeGreaterThanOrEqual(lat);
      expect(tileY2lat(y + 1, z)).toBeLessThan(lat);
    }
  });

  it("tileBbox は [w<e, s<n]", () => {
    const [w, s, e, n] = tileBbox(14550, 6449, 14);
    expect(w).toBeLessThan(e);
    expect(s).toBeLessThan(n);
  });
});

describe("bboxIntersects", () => {
  it("重なり/非重なりを判定", () => {
    expect(bboxIntersects([0, 0, 2, 2], [1, 1, 3, 3])).toBe(true);
    expect(bboxIntersects([0, 0, 1, 1], [2, 2, 3, 3])).toBe(false);
    expect(bboxIntersects([0, 0, 1, 1], [1, 1, 2, 2])).toBe(true); // 接触
  });
});

describe("tilesForPolys", () => {
  it("ポリゴンを覆うタイルだけ返す（海上タイルは除外）", () => {
    // 経度139.0〜139.1, 緯度35.0〜35.1 の小さな正方形
    const feat = turf.polygon([[
      [139.0, 35.0], [139.1, 35.0], [139.1, 35.1], [139.0, 35.1], [139.0, 35.0],
    ]]);
    const polys = [{ feat, bbox: turf.bbox(feat) }];
    const z = 13;
    const result = tilesForPolys(polys, z);
    expect(result.length).toBeGreaterThan(0);
    // 返るタイルはすべてポリゴン bbox と交差する
    for (const t of result) {
      expect(bboxIntersects(tileBbox(t.x, t.y, z), polys[0].bbox)).toBe(true);
    }
  });

  it("空ポリゴン集合では空配列", () => {
    expect(tilesForPolys([], 13)).toEqual([]);
  });
});

describe("pool", () => {
  it("全 item を処理する（同時実行数で取りこぼさない）", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const seen: number[] = [];
    await pool(items, 4, async (x) => { seen.push(x); });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });
});

describe("findPolyForPoint", () => {
  // 西 [0,0]-[1,1] と 東 [1,0]-[2,1] が隣接（境界 x=1 を共有）。
  const west = squarePoly("W", [0, 0, 1, 1]);
  const east = squarePoly("E", [1, 0, 2, 1]);
  const polys = [west, east];

  it("点を含むポリゴンを返す", () => {
    expect(findPolyForPoint([0.5, 0.5], polys)?.code).toBe("W");
    expect(findPolyForPoint([1.5, 0.5], polys)?.code).toBe("E");
  });

  it("どのポリゴンにも入らない点は null", () => {
    expect(findPolyForPoint([5, 5], polys)).toBeNull();
  });

  it("bbox 外の点は booleanPointInPolygon を呼ばず早期に弾く（null）", () => {
    expect(findPolyForPoint([-1, -1], polys)).toBeNull();
  });

  it("配列の先頭一致を返す（wardsFirst で区を優先する用途）", () => {
    // 重なる2ポリゴンで先に並べた方が勝つ（政令市の区→親市の割当順に対応）。
    const ward = squarePoly("WARD", [0, 0, 2, 2]);
    const city = squarePoly("CITY", [0, 0, 2, 2]);
    expect(findPolyForPoint([1, 1], [ward, city])?.code).toBe("WARD");
    expect(findPolyForPoint([1, 1], [city, ward])?.code).toBe("CITY");
  });
});
