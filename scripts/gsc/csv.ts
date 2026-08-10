// CSV 出力ヘルパー。Excel での日本語文字化けを避けるため UTF-8 BOM 付きで書き出す。

import fs from "node:fs";
import { round } from "./format";

export interface CsvColumn<T> {
  /** 列の識別子（出力には使わないが、定義の可読性・テスト用に持たせる） */
  key: string;
  header: string;
  /** 行から値を取り出す。number は escapeField 側で丸めて整形する。 */
  value: (row: T) => string | number | undefined;
}

function escapeField(v: string | number | undefined): string {
  if (v === undefined || v === null) return "";
  const s = typeof v === "number" ? (Number.isInteger(v) ? String(v) : String(round(v, 4))) : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeField(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeField(c.value(row))).join(","));
  return [header, ...lines].join("\r\n") + "\r\n";
}

const BOM = "﻿";

export function writeCsvFile<T>(filePath: string, rows: T[], columns: CsvColumn<T>[]): void {
  fs.writeFileSync(filePath, BOM + toCsv(rows, columns), "utf-8");
}
