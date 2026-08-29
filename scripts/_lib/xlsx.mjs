// Excel 出典スクリプト共通のボイラープレート（fetch-waitlist / fetch-childcare /
// fetch-age-stats / fetch-fiscal が利用）。
//
// - xlsx の ESM ビルド（xlsx.mjs）は fs を自動注入しないため、readFile 前の
//   `XLSX.set_fs(fs)` が必須（忘れると readFile が silent に失敗する）。この儀式を
//   ここに1回だけ書く。
// - 入力パスの解決は「env 指定 → 引数の *.xlsx → 既定パス」の順（ワークフローは
//   env、手元実行は引数か /tmp 既定、という運用に全スクリプトで統一）。
//
// 注: fetch-foreign-residents / fetch-future-population も xlsx を使うが、独自の
// パス規約（複数ファイル・ディレクトリ指定）があるため本ヘルパーへは未移行。

import { existsSync } from "node:fs";
import * as fs from "node:fs";
import XLSX from "xlsx";

XLSX.set_fs?.(fs);

/**
 * 入力 Excel のパスを解決する。env → 引数の .xlsx → 既定パスの順で、
 * 実在しなければエラー表示して終了する（全スクリプト共通の入口）。
 */
export function resolveXlsxPath(envVar, defaultPath) {
  const p = process.env[envVar] ||
    process.argv.find((a) => a.endsWith(".xlsx")) ||
    defaultPath;
  if (!existsSync(p)) {
    console.error(`Excel not found: ${p}`);
    process.exit(1);
  }
  return p;
}

/** ワークブックを読む（set_fs 済み）。シート名でのアクセスは wb.Sheets[name]。 */
export function readWorkbook(path) {
  return XLSX.readFile(path);
}

/** シートを二次元配列へ（全スクリプト共通のパースオプション）。 */
export function sheetRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true });
}
