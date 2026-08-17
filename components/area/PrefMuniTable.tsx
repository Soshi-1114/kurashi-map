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

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "自治体", numeric: false },
  { key: "rent", label: "家賃平均", numeric: true },
  { key: "landPrice", label: "地価（住宅地）", numeric: true },
  { key: "population", label: "人口", numeric: true },
];

// データなしセンチネル（家賃・地価は value<=0）の行は、並び替え方向によらず常に末尾へ送る。
function compareRows(a: PrefMuniRow, b: PrefMuniRow, key: SortKey, dir: 1 | -1): number {
  if (key === "name") return dir * a.label.localeCompare(b.label, "ja");
  const av = key === "rent" ? a.rent : key === "landPrice" ? a.landPrice : a.population;
  const bv = key === "rent" ? b.rent : key === "landPrice" ? b.landPrice : b.population;
  const hasValue = key === "population" ? () => true : (v: number) => v > 0;
  const aMissing = !hasValue(av);
  const bMissing = !hasValue(bv);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return dir * (av - bv);
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
              const active = sort?.key === col.key;
              const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none";
              return (
                <th key={col.key} scope="col" className={col.numeric ? "num" : undefined} aria-sort={ariaSort}>
                  <button type="button" className="pref-table-sort" onClick={() => toggleSort(col.key)}>
                    {col.label}
                    <span className="pref-table-sort-icon" aria-hidden="true">
                      {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
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
