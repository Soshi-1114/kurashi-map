import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// "@/..." を Next と同じくリポジトリルート起点に解決する。
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  // .tsx を React 17+ の自動 JSX ランタイムで変換（テストで React を明示 import しない）。
  esbuild: { jsx: "automatic" },
  test: {
    // lib のロジックテストは node 環境（既定）。tests/components/ の React
    // コンポーネントテストは各ファイル冒頭の `// @vitest-environment jsdom`
    // プラグマで jsdom に切り替える（vitest 3 で environmentMatchGlobs は削除されたため）。
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // jest-dom のマッチャ拡張（toBeInTheDocument 等）。node テストにも読み込まれるが
    // マッチャを足すだけで DOM 依存はないため無害。
    setupFiles: ["tests/setup.ts"],
  },
});
