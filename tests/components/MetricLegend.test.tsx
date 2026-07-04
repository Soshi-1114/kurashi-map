// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import MetricLegend from "@/components/map/MetricLegend";
import type { OverlayKey } from "@/components/map/mapConstants";

afterEach(cleanup);

const overlays = (...keys: OverlayKey[]) => new Set<OverlayKey>(keys);

describe("MetricLegend", () => {
  it("塗り分けなし・オーバーレイなしでは何も描画しない", () => {
    const { container } = render(
      <MetricLegend metricKey="none" overlays={overlays()} belowHazardZoom={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("塗り分け指標を選ぶと凡例見出しを出す", () => {
    render(<MetricLegend metricKey="rent" overlays={overlays()} belowHazardZoom={false} />);
    expect(screen.getByText("塗り分け中")).toBeInTheDocument();
    expect(screen.getByText("民営借家中央値（円/月）")).toBeInTheDocument();
  });

  it("塗り分けありでは「データなし」凡例も出す（honesty 方針の可視化）", () => {
    render(<MetricLegend metricKey="rent" overlays={overlays()} belowHazardZoom={false} />);
    expect(screen.getByText(/データなし/)).toBeInTheDocument();
  });

  it("避難所オーバーレイのみ選択時は塗り分け凡例を出さずオーバーレイ凡例だけ出す", () => {
    render(<MetricLegend metricKey="none" overlays={overlays("shelter")} belowHazardZoom={false} />);
    expect(screen.queryByText("塗り分け中")).toBeNull();
    expect(screen.getByText(/指定緊急避難場所/)).toBeInTheDocument();
  });

  it("災害オーバーレイがズーム閾値未満ならズーム誘導を出す（区域の凡例は出さない）", () => {
    render(<MetricLegend metricKey="none" overlays={overlays("flood")} belowHazardZoom={true} />);
    expect(screen.getByText(/ズームすると災害リスク区域/)).toBeInTheDocument();
    expect(screen.queryByText("土砂災害警戒区域")).toBeNull();
  });

  it("土砂オーバーレイがズーム閾値以上なら警戒/特別警戒の凡例を出す", () => {
    render(<MetricLegend metricKey="none" overlays={overlays("landslide")} belowHazardZoom={false} />);
    expect(screen.getByText("土砂災害警戒区域")).toBeInTheDocument();
    expect(screen.getByText("警戒区域")).toBeInTheDocument();
    expect(screen.getByText("特別警戒区域")).toBeInTheDocument();
  });

  it("避難所と災害種別を併用時は避難所凡例に「選択中の災害に有効な場所」を添える", () => {
    render(<MetricLegend metricKey="none" overlays={overlays("flood", "shelter")} belowHazardZoom={false} />);
    expect(screen.getByText(/選択中の災害に有効な場所/)).toBeInTheDocument();
  });
});
