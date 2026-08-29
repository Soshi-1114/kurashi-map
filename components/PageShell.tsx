import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumb, { type Crumb } from "@/components/Breadcrumb";

type Width = "default" | "narrow" | "wide";

const WIDTH_CLASS: Record<Width, string> = {
  default: "",
  narrow: " page-root--narrow", // 読み物系（/about /privacy /search 等）
  wide: " page-root--wide",     // 情報量の多い自治体詳細
};

// スクロールするページ共通のシェル（ヘッダー＋コンテナ＋パンくず）。
// トップと /map/* は全画面地図シェル（MapView 内の .app-header）を使うので対象外。
// innerClassName には既存の名前空間クラス（rk-root / ad-root / cmp-root 等）を渡す。
export default function PageShell({
  width = "default",
  innerClassName,
  trail,
  children,
}: {
  width?: Width;
  innerClassName?: string;
  trail: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className={`page-root${WIDTH_CLASS[width]}${innerClassName ? ` ${innerClassName}` : ""}`}>
        <Breadcrumb items={trail} />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
