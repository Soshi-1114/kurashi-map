// ハザード・生活インフラの「評価対象外」判定。北方領土など reinfolib に
// データが存在しない自治体は source に「対象外」を含め、誤って「災害なし/0施設」と
// 見せないために UI 側で「データなし」表示へ分岐する。
export function isHazardEvaluated(source: string): boolean {
  const s = String(source ?? "");
  return !s.includes("対象外") && !s.includes("未評価");
}

export function isAmenitiesCounted(source: string): boolean {
  const s = String(source ?? "");
  return !s.includes("対象外") && !s.includes("未集計");
}

// 「対象外（理由）」の source から理由テキストだけを取り出す。
// 例: "対象外（北方領土）" → "北方領土"。対象外表記でなければそのまま返す
// （末尾の ） を不用意に削らないよう全体パターンに一致した時だけ抜き出す）。
export function coverageReason(source: string): string {
  const m = String(source ?? "").match(/^対象外（(.*)）$/);
  return m ? m[1] : String(source ?? "");
}
