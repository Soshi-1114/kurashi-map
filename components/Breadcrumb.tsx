import { Fragment } from "react";
import Link from "next/link";

export type Crumb = {
  name: string;
  /** 省略すると現在地（リンクにしない）。末尾の項目は href を渡さないのが通例。 */
  href?: string;
};

// 見た目のパンくず。全ページで同一マークアップにするための server component。
// 各ページが持つ JSON-LD の BreadcrumbList とは別物（構造化データ側は各ページのまま）。
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="パンくず" className="breadcrumb">
      {/* Fragment で包むのは .breadcrumb が flex コンテナで、区切りと項目を
          それぞれ独立した flex item に保つ必要があるため（span で包むと崩れる）。 */}
      {items.map((item, i) => (
        <Fragment key={`${item.name}-${i}`}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <Link href={item.href} className="breadcrumb-link">{item.name}</Link>
          ) : (
            <span className="breadcrumb-current">{item.name}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
