import { describe, it, expect } from "vitest";
import {
  SHINDAN_AXES, EMPTY_WEIGHTS, hasAnyWeight, buildShindanEntries, runShindan,
  encodeWeights, decodeWeights, decodeRegions,
  type ShindanWeights, type ShindanEntry,
} from "@/lib/shindan";
import { muni, metric, hazard, futurePop } from "../_fixtures";

// 街診断のスコアリング。既存の住みやすさ軸の重み付き平均であること、
// 重視軸のデータが無い自治体の除外（欠損を点数化しない honesty）、URL 同期を守る。

const weights = (partial: Partial<ShindanWeights>): ShindanWeights => ({ ...EMPTY_WEIGHTS, ...partial });

// SHINDAN_AXES 順（rent, access, childcare, disaster, infrastructure, future）で
// 星を直接指定したエントリを作るテスト用ヘルパー。
const entry = (code: string, s: number[]): ShindanEntry => ({ code, name: `市${code}`, s });

describe("buildShindanEntries", () => {
  it("livabilityScore の5軸＋将来性を SHINDAN_AXES 順に前計算する", () => {
    const m = muni({
      rent: metric({ value: 45000 }),            // rent: 5万未満 → 5
      waitlistChildren: metric({ value: 0 }),     // childcare: ゼロ → 5
      hazard: hazard(),                           // disaster: リスクなし → 5
      amenities: {
        stations: 30, preschools: 80, medicalFacilities: 80,
        source: "国土数値情報", asOf: "2025",
      },                                          // access 5 / infrastructure 5
      futurePopulation: futurePop(),              // 580000/600000 = -3.3% → 4（地図と同区分）
    });
    const [e] = buildShindanEntries([m]);
    expect(e.s).toEqual([5, 5, 5, 5, 5, 4]);
  });

  it("将来性の星は地図コロプレスと同じしきい値で刻む（色ランクと星が一致）", () => {
    const at = (base2020: number, t2050: number) =>
      buildShindanEntries([muni({ futurePopulation: futurePop({ base2020, total: { "2050": t2050 } }) })])[0].s[5];
    expect(at(100000, 100000)).toBe(5); // 0% = 増加見込み
    expect(at(100000, 95000)).toBe(4);  // -5%
    expect(at(100000, 80000)).toBe(3);  // -20%
    expect(at(100000, 60000)).toBe(2);  // -40%
    expect(at(100000, 40000)).toBe(1);  // -60%
  });

  it("データなしの軸は 0（センチネル）", () => {
    const m = muni({ rent: metric({ value: 0, source: "対象外" }) }); // rent なし・amenities なし・future なし
    const [e] = buildShindanEntries([m]);
    // rent=0, access=0, childcare=5(待機0), disaster=5, infrastructure=0, future=0
    expect(e.s).toEqual([0, 0, 5, 5, 0, 0]);
  });
});

describe("runShindan", () => {
  it("重みなしなら結果を出さない", () => {
    expect(hasAnyWeight(EMPTY_WEIGHTS)).toBe(false);
    const { results } = runShindan([entry("11201", [5, 5, 5, 5, 5, 5])], EMPTY_WEIGHTS, []);
    expect(results).toEqual([]);
  });

  it("重み付き平均（星×20）で降順、同点は団体コード順", () => {
    const entries = [
      entry("11202", [3, 5, 3, 5, 5, 5]), // rent3
      entry("11201", [5, 5, 3, 5, 5, 5]), // rent5
      entry("11203", [5, 5, 3, 5, 5, 5]), // rent5（11201と同点）
    ];
    const { results } = runShindan(entries, weights({ rent: 2 }), []);
    expect(results.map((r) => r.entry.code)).toEqual(["11201", "11203", "11202"]);
    expect(results[0].score).toBe(100); // 星5 → 100
    expect(results[2].score).toBe(60);  // 星3 → 60
  });

  it("重みの大小がスコアに反映される（とても重視=2 が やや=1 の2倍）", () => {
    const e = entry("11201", [5, 1, 5, 5, 5, 5]); // rent5, access1
    const both = runShindan([e], weights({ rent: 2, access: 1 }), []).results[0];
    // (5*2 + 1*1) / 3 = 3.67 → 73
    expect(both.score).toBe(73);
    expect(both.axisStars.map((a) => a.key)).toEqual(["rent", "access"]);
  });

  it("重視した軸のデータが無い自治体は除外（欠損を点数化しない）", () => {
    const entries = [entry("11201", [0, 5, 5, 5, 5, 5]), entry("11202", [3, 5, 5, 5, 5, 5])]; // 11201はrentデータなし
    const { results, eligibleCount } = runShindan(entries, weights({ rent: 1 }), []);
    expect(results.map((r) => r.entry.code)).toEqual(["11202"]);
    expect(eligibleCount).toBe(1);
  });

  it("地方フィルタは団体コード先頭2桁で絞る（複数選択可・空=全国）", () => {
    const entries = [entry("01100", [5, 5, 5, 5, 5, 5]), entry("13104", [5, 5, 5, 5, 5, 5])];
    expect(runShindan(entries, weights({ rent: 1 }), ["hokkaido"]).results.map((r) => r.entry.code)).toEqual(["01100"]);
    expect(runShindan(entries, weights({ rent: 1 }), ["hokkaido", "kanto"]).eligibleCount).toBe(2);
    expect(runShindan(entries, weights({ rent: 1 }), []).eligibleCount).toBe(2);
  });
});

describe("URL 同期", () => {
  it("encode/decode がラウンドトリップし、不正値は空の重みに落ちる", () => {
    const w = weights({ rent: 2, disaster: 1, future: 2 });
    expect(decodeWeights(encodeWeights(w))).toEqual(w);
    expect(decodeWeights(null)).toEqual(EMPTY_WEIGHTS);
    expect(decodeWeights("999999")).toEqual(EMPTY_WEIGHTS);
    expect(decodeWeights("21")).toEqual(EMPTY_WEIGHTS); // 桁不足
  });

  it("decodeRegions は未知キーを落とす", () => {
    expect(decodeRegions("kanto,unknown,tokai")).toEqual(["kanto", "tokai"]);
    expect(decodeRegions(null)).toEqual([]);
  });

  it("軸の数と並び順を固定する（共有URL ?w= の互換契約。並び替えは旧URLの重みを別の軸に付け替えてしまう）", () => {
    expect(SHINDAN_AXES.map((a) => a.key)).toEqual([
      "rent", "access", "childcare", "disaster", "infrastructure", "future",
    ]);
    expect(encodeWeights(EMPTY_WEIGHTS)).toHaveLength(SHINDAN_AXES.length);
  });
});
