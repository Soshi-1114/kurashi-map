import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MachiMap",
  description: "市区町村の住みやすさを地図で横断比較するサービス",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
