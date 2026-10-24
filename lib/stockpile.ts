/** 在宅備蓄の確認用。地域のリスク値や避難可否とは結び付けない。 */
export const STOCKPILE_KEY = "kurashimap-stockpile-v1";
export const STOCKPILE_SOURCES = [
  { label: "政府広報：災害に事前に備える", url: "https://www.gov-online.go.jp/tokusyu/bousai/preparation.html" },
  { label: "農林水産省：飲料・調理用の水", url: "https://www.maff.go.jp/j/zyukyu/foodstock/imadoki/imadoki02_10.html" },
  { label: "農林水産省：食品ストックガイド", url: "https://www.maff.go.jp/j/zyukyu/foodstock/chapter01.html" },
] as const;
export const STOCKPILE_ITEMS = [
  { id: "food", name: "普段食べる食品", note: "選んだ日数分を目安に、主食・主菜・副菜を確認。調理不要の食品も用意しましょう。", source: 2 },
  { id: "toilet", name: "携帯トイレ・衛生用品", note: "断水時に使えるトイレ、トイレットペーパー、ウェットティッシュなど。", source: 0 },
  { id: "light", name: "照明・予備電池", note: "家にある懐中電灯などの点灯と、対応する電池の残量を確認しましょう。", source: 0 },
  { id: "radio", name: "情報・充電の手段", note: "携帯ラジオや、充電済みのモバイルバッテリーなどを確認しましょう。", source: 0 },
  { id: "cooking", name: "調理に必要なもの", note: "食品の調理方法を確認。カセットコンロなどは説明書に従って安全に使用してください。", source: 2 },
  { id: "personal", name: "家族ごとに必要なもの", note: "常備薬・眼鏡・乳幼児用品・アレルギー対応食品など、家族に必要なものを確認しましょう。", source: 2 },
] as const;
export type StockStatus = "unknown" | "needed" | "ready";
export type StockpileState = { version: 1; people: number | null; days: 3 | 7; water: number | null; statuses: Record<string, StockStatus> };
export const emptyStockpile = (): StockpileState => ({ version: 1, people: null, days: 7, water: null, statuses: {} });
export function waterAmounts(people: number, days: 3 | 7, water: number | null) {
  const required = people * days * 3;
  return { required, shortage: water === null ? null : Math.max(0, Math.round((required - water) * 10) / 10) };
}
export function parseStockpile(raw: string): StockpileState | null {
  try {
    const v = JSON.parse(raw);
    if (!v || v.version !== 1 || ![3, 7].includes(v.days)) return null;
    if (v.people !== null && (!Number.isInteger(v.people) || v.people < 1 || v.people > 20)) return null;
    if (v.water !== null && (typeof v.water !== "number" || !Number.isFinite(v.water) || v.water < 0 || v.water > 10000)) return null;
    if (!v.statuses || typeof v.statuses !== "object" || Array.isArray(v.statuses)) return null;
    const statuses: Record<string, StockStatus> = {};
    for (const item of STOCKPILE_ITEMS) {
      const status = v.statuses[item.id];
      if (status !== undefined && !["unknown", "needed", "ready"].includes(status)) return null;
      if (status) statuses[item.id] = status;
    }
    return { version: 1, people: v.people, days: v.days, water: v.water, statuses };
  } catch { return null; }
}
export function stockpileLists(state: StockpileState) {
  const needed: string[] = [], unknown: string[] = [];
  if (state.people !== null) {
    const { shortage } = waterAmounts(state.people, state.days, state.water);
    if (shortage === null) unknown.push("飲料・調理用の水：手持ち量を確認");
    else if (shortage > 0) needed.push(`飲料・調理用の水：あと${shortage}L（2Lボトルなら${Math.ceil(shortage / 2)}本）`);
  }
  for (const item of STOCKPILE_ITEMS) {
    const status = state.statuses[item.id] ?? "unknown";
    if (status === "needed") needed.push(item.name);
    if (status === "unknown") unknown.push(item.name);
  }
  return { needed, unknown };
}
export function stockpileText(state: StockpileState) {
  const { needed, unknown } = stockpileLists(state);
  return [`家庭の備蓄チェック｜${state.people}人・${state.days}日分`, "買い足す・準備するもの", ...(needed.length ? needed.map(x => `□ ${x}`) : ["現在の入力ではありません"]), "まだ確認していないもの", ...(unknown.length ? unknown.map(x => `□ ${x}`) : ["現在の入力ではありません"]), "在宅備蓄の目安です。避難の判断・安全の保証には使えません。", ...STOCKPILE_SOURCES.map(s => `${s.label} ${s.url}`)].join("\n");
}
