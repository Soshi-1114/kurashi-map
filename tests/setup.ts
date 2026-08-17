// jest-dom のカスタムマッチャ（toBeInTheDocument / toHaveAttribute 等）を
// vitest の expect に登録する。tests/components/ の jsdom テストで使う。
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom の localStorage は同一ファイル内のテスト間で共有され続けるため、
// 検索履歴（useSearchHistory）等の localStorage 利用テストが順序依存で
// 汚染されないよう、テストごとにクリアする（node 環境には localStorage が無い）。
afterEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});
