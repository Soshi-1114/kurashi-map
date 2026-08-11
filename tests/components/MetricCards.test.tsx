// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MetricCards } from "@/components/AreaPanel";
import { muni } from "../_fixtures";

afterEach(cleanup);

const SOURCE = "国立社会保障・人口問題研究所 日本の地域別将来推計人口（令和5年推計）";

describe("MetricCards の 2050年推計人口カード", () => {
  it("実データがあれば人数と「推計」ラベルを表示する", () => {
    const m = muni({
      futurePopulation: {
        base2020: 600000,
        total: { "2025": 598000, "2030": 596000, "2035": 592000, "2040": 588000, "2045": 584000, "2050": 580000 },
        young2050: 60000,
        working2050: 340000,
        elderly2050: 180000,
        source: SOURCE,
        asOf: "2023",
      },
    });
    render(<MetricCards m={m} />);
    expect(screen.getByText("2050年推計人口")).toBeInTheDocument();
    expect(screen.getByText("580,000 人")).toBeInTheDocument();
    // est フラグ由来の「推計」バッジが（このカードで）表示される
    expect(screen.getAllByText("推計").length).toBeGreaterThan(0);
  });

  it("対象外センチネルは「対象外」と理由を表示する", () => {
    const m = muni({
      futurePopulation: {
        base2020: 0,
        total: {},
        young2050: 0,
        working2050: 0,
        elderly2050: 0,
        source: "対象外（浜通り地域として一括推計のため市町村別の推計なし）",
        asOf: "2023",
      },
    });
    render(<MetricCards m={m} />);
    expect(screen.getByText("2050年推計人口")).toBeInTheDocument();
    expect(screen.getByText("対象外")).toBeInTheDocument();
    expect(screen.getByText(/浜通り地域として一括推計/)).toBeInTheDocument();
  });

  it("フィールド未収録でも壊れず「対象外」にフォールバックする", () => {
    render(<MetricCards m={muni()} />);
    expect(screen.getByText("2050年推計人口")).toBeInTheDocument();
    expect(screen.getByText("対象外")).toBeInTheDocument();
  });
});
