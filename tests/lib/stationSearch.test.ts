import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { searchStationIndex } from "@/lib/stationSearch";

type Entry = [string, string, number, number];

const INDEX: Entry[] = [
  ["大久保", "05211", 140.06305, 39.87091],
  ["大久保", "13104", 139.69745, 35.70063],
  ["新大久保", "13104", 139.7001, 35.70123],
  ["品川", "13103", 139.73809, 35.62771],
  ["品川シーサイド", "13109", 139.74926, 35.60916],
  ["北品川", "13109", 139.73934, 35.62259],
  ["蕨", "11223", 139.69042, 35.82793],
];

describe("searchStationIndex", () => {
  it("完全一致 > 前方一致 > 部分一致の順で返す", () => {
    const hits = searchStationIndex(INDEX, "品川");
    expect(hits.map((h) => h.name)).toEqual(["品川", "品川シーサイド", "北品川"]);
    expect(hits[0]).toEqual({ name: "品川", code: "13103", lng: 139.73809, lat: 35.62771 });
  });

  it("末尾の「駅」を除いて照合する（1文字駅名も「〇駅」で引ける）", () => {
    expect(searchStationIndex(INDEX, "品川駅")[0].name).toBe("品川");
    expect(searchStationIndex(INDEX, "蕨駅")).toEqual([{ name: "蕨", code: "11223", lng: 139.69042, lat: 35.82793 }]);
  });

  it("同名駅は自治体ごとに別の候補として返す", () => {
    const hits = searchStationIndex(INDEX, "大久保");
    expect(hits.slice(0, 2).map((h) => h.code)).toEqual(["05211", "13104"]);
  });

  it("2文字未満・「駅」のみ・空白クエリは空を返す", () => {
    expect(searchStationIndex(INDEX, "蕨")).toEqual([]);
    expect(searchStationIndex(INDEX, "駅")).toEqual([]);
    expect(searchStationIndex(INDEX, "  ")).toEqual([]);
  });

  it("limit を尊重する", () => {
    const many: Entry[] = Array.from({ length: 20 }, (_, i) => [`朝日${i}`, String(10000 + i), 135, 35]);
    expect(searchStationIndex(many, "朝日", 6)).toHaveLength(6);
  });
});

describe("実データ（data/stations.json）", () => {
  const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/stations.json"), "utf8"));
  const index = raw.stations as Entry[];

  it("全国の駅を収録している（S12 は約9,300駅）", () => {
    expect(index.length).toBeGreaterThan(8000);
  });

  it("「品川駅」で港区（13103）の駅が先頭に返る", () => {
    const hits = searchStationIndex(index, "品川駅");
    expect(hits[0].name).toBe("品川");
    expect(hits[0].code).toBe("13103");
  });

  it("県境の駅が正しい県の自治体に割り当たっている", () => {
    // フォールバック割当を県ループ内で行うと、先に処理した県の最近傍へ誤割当される
    // （例: 川崎駅が多摩川対岸の大田区になる）。全県 PIP 後の最小距離で決める
    // 2段方式の回帰テスト。
    const codeOf = (name: string) => index.filter((e) => e[0] === name).map((e) => e[1]);
    expect(codeOf("川崎")).toEqual(["14132"]);      // 川崎市川崎区（× 大田区 13111）
    expect(codeOf("武蔵小杉")).toEqual(["14133"]);  // 川崎市中原区
    expect(codeOf("登戸")).toEqual(["14135"]);      // 川崎市多摩区
  });

  it("政令市の駅は親市ではなく区コードに割り当たっている", () => {
    // 政令市の親コード（区の dissolve 対象）が混入していないこと
    const parents = new Set([
      "01100", "04100", "11100", "12100", "14100", "14130", "14150", "15100", "22100", "22130",
      "23100", "26100", "27100", "27140", "28100", "33100", "34100", "40100", "40130", "43100",
    ]);
    expect(index.filter((e) => parents.has(e[1]))).toEqual([]);
  });

  it("全駅が妥当な自治体コードと日本域内の座標を持つ", () => {
    for (const [name, code, lng, lat] of index) {
      expect(name.length).toBeGreaterThan(0);
      expect(code).toMatch(/^\d{5}$/);
      expect(lng).toBeGreaterThan(122);
      expect(lng).toBeLessThan(154);
      expect(lat).toBeGreaterThan(24);
      expect(lat).toBeLessThan(46);
    }
  });
});
