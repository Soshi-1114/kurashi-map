import { describe, expect, it } from "vitest";
import { selectedMapMetric } from "@/lib/selectedMapMetric";
import { futurePop, metric, muni } from "../_fixtures";

describe("selectedMapMetric", () => {
  it("地図で選択中の指標を表示し、家賃の欠損を数値として扱わない", () => {
    const m = muni({ rent: metric({ value: 0, source: "集計対象外" }) });
    expect(selectedMapMetric(m, "rent")).toMatchObject({ label: "民営借家の家賃平均", value: "データなし" });
    expect(selectedMapMetric(m, "landPrice")).toMatchObject({ label: "住宅地の地価", value: "200,000 円/㎡" });
  });

  it("0% と公的な将来推計を欠損と区別する", () => {
    const m = muni({
      foreignResidents: metric({ value: 0, unit: "人", source: "出入国在留管理庁 在留外国人統計" }),
      futurePopulation: futurePop({ total: { "2050": 600000 } }),
    });
    expect(selectedMapMetric(m, "foreignRatio").value).toBe("0.00%");
    expect(selectedMapMetric(m, "futurePopulation")).toMatchObject({ value: "0.0%" });
    expect(selectedMapMetric(m, "futurePopulation").note).toContain("公的推計");
  });
});
