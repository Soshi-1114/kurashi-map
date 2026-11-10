// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SiteLink from "@/components/SiteLink";
import { navigateDocument } from "@/lib/adsense";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/lib/adsense", async original => ({ ...await original<object>(), navigateDocument: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ onNavigate, prefetch: _prefetch, replace: _replace, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
  onNavigate?: (event: { preventDefault(): void }) => void; prefetch?: boolean; replace?: boolean;
}) => <a {...props} onClick={event => {
  props.onClick?.(event);
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || props.target === "_blank") return;
  let blocked = false;
  event.preventDefault();
  onNavigate?.({ preventDefault() { blocked = true; } });
  if (!blocked) router.push(props.href);
}} /> }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_RANKING_SLOT_ID", "1234567890");
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_AREA_SLOT_ID", "0987654321");
  window.history.replaceState(null, "", "/ranking/population-most");
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("広告ページの文書遷移", () => {
  it("既存クリック計測の後に文書遷移し、クエリを保持する", () => {
    const clicked = vi.fn();
    render(<SiteLink href="/compare?codes=11203,11201&from=ranking" onClick={clicked}>比較</SiteLink>);
    fireEvent.click(screen.getByText("比較"));
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(navigateDocument).toHaveBeenCalledWith("http://localhost:3000/compare?codes=11203,11201&from=ranking", undefined);
    expect(router.push).not.toHaveBeenCalled();
    expect(clicked.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(navigateDocument).mock.invocationCallOrder[0]);
  });
  it("比較候補などpreventDefaultされたクリックを遷移へ変えない", () => {
    render(<SiteLink href="/compare?codes=11203" onClick={e => e.preventDefault()}>追加</SiteLink>);
    fireEvent.click(screen.getByText("追加"));
    expect(navigateDocument).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
  it("onNavigateによる既存の遷移中止を維持する", () => {
    render(<SiteLink href="/denki" onNavigate={e => e.preventDefault()}>電気</SiteLink>);
    fireEvent.click(screen.getByText("電気"));
    expect(navigateDocument).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
  it("修飾クリック・新規タブを文書遷移に置換しない", () => {
    render(<SiteLink href="/compare" target="_blank">比較</SiteLink>);
    fireEvent.click(screen.getByText("比較"), { metaKey: true });
    expect(navigateDocument).not.toHaveBeenCalled();
  });
  it("広告停止時は通常のNext遷移を使う", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    render(<SiteLink href="/denki">電気</SiteLink>);
    fireEvent.click(screen.getByText("電気"));
    expect(navigateDocument).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/denki");
  });
});
