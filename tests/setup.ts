// jest-dom のカスタムマッチャ（toBeInTheDocument / toHaveAttribute 等）を
// vitest の expect に登録する。tests/components/ の jsdom テストで使う。
import "@testing-library/jest-dom/vitest";
