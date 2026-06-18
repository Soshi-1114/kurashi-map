import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "まちさがし（仮）",
  description: "市区町村の住みやすさを地図で横断比較",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
