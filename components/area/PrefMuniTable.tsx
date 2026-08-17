"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { hasRent } from "@/lib/rentColor";
import { hasLandPrice } from "@/lib/landPrice";

// 県ページ「全市区町村一覧」テーブルの行。Municipality 全体ではなく表示に
// 必要な値だけを渡す（クライアントへ送るペイロードを最小化する設計方針）。
export type PrefMuniRow = {
  code: string;
  pref: string;
  label: string; // displayName ?? name
  rent: number;
  landPrice: number;
  population: number;
};

type SortKey = "name" | "rent" | "landPrice" | "population";
type SortState = { key: SortKey; dir: "asc" | "desc" };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "自治体" },
  { key: "rent", label: "家賃平均" },
  { key: "landPrice", label: "地価（住宅地）" },
  { key: "population", label: "人口" },
];

// 数値列の値とデータ有無を取り出す。有無判定は表示（85〜87行目）と同じ
// hasRent/hasLandPrice をそのまま使い、センチネル定義の重複実装を避ける。
function numericField(m: PrefMuniRow, key: Exclude<SortKey, "name">): { value: number; hasValue: boolean } {
  if (key === "rent") return { value: m.rent, hasValue: hasRent(m.rent) };
  if (key === "landPrice") return { value: m.landPrice, hasValue: hasLandPrice(m.landPrice) };
  return { value: m.population, hasValue: true };
}

// データなし（家賃・地価のセンチネル）の行は、並び替え方向によらず常に末尾へ送る。
function compareRows(a: PrefMuniRow, b: PrefMuniRow, key: SortKey, dir: 1 | -1): number {
  if (key === "name") return dir * a.label.localeCompare(b.label, "ja");
  const av = numericField(a, key);
  const bv = numericField(b, key);
  if (!av.hasValue && !bv.hasValue) return 0;
  if (!av.hasValue) return 1;
  if (!bv.hasValue) return -1;
  return dir * (av.value - bv.value);
}

export function PrefMuniTable({ rows }: { rows: PrefMuniRow[] }) {
  const [sort, setSort] = useState<SortState | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compareRows(a, b, sort.key, dir));
  }, [rows, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (!prev || prev.key !== key ? { key, dir: "asc" } : { key, dir: prev.dir === "asc" ? "desc" : "asc" }));
  };

  return (
    <div className="pref-table-wrap">
      <table className="pref-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              // このヘッダーが現在の並び替え対象なら "asc"/"desc"、そうでなければ null。
              // aria-sort・矢印アイコンの両方をここから1箇所で導く（non-null assertion 不要）。
              const activeDir = sort?.key === col.key ? sort.dir : null;
              return (
                <th key={col.key} scope="col" className={col.key !== "name" ? "num" : undefined} aria-sort={activeDir ? (activeDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="pref-table-sort" onClick={() => toggleSort(col.key)}>
                    {col.label}
                    <span className="pref-table-sort-icon" aria-hidden="true">
                      {activeDir === "asc" ? "▲" : activeDir === "desc" ? "▼" : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.code}>
              <th scope="row">
                <Link href={`/area/${m.pref}/${m.code}`} className="pref-table-link">
                  {m.label}
                </Link>
              </th>
              <td className="num">{hasRent(m.rent) ? `${m.rent.toLocaleString()}円` : "—"}</td>
              <td className="num">{hasLandPrice(m.landPrice) ? `${m.landPrice.toLocaleString()}円/㎡` : "—"}</td>
              <td className="num">{m.population.toLocaleString()}人</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
