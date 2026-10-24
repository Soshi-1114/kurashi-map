"use client";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { STOCKPILE_ITEMS, STOCKPILE_KEY, STOCKPILE_SOURCES, emptyStockpile, parseStockpile, stockpileLists, stockpileText, waterAmounts, type StockpileState, type StockStatus } from "@/lib/stockpile";

const labels: Record<StockStatus, string> = { unknown: "未確認", needed: "要準備", ready: "準備済み" };
function event(action: string, detail: Record<string, unknown> = {}) {
  const from = new URLSearchParams(window.location.search).get("from");
  const entryPlacement = from === "area" || from === "hazard-map" ? from : "direct";
  track(`stockpile_${action}`, { measurement_version: "2026-10-24", entry_placement: entryPlacement, ...detail });
}
export default function StockpileClient() {
  const [state, setState] = useState<StockpileState>(emptyStockpile);
  const [loaded, setLoaded] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [message, setMessage] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showList, setShowList] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    // SSRと初回描画を一致させ、マウント後に端末内の保存内容を復元する。
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STOCKPILE_KEY);
      if (raw) {
        const saved = parseStockpile(raw);
        if (saved) { setState(saved); setSaveMessage("この端末に保存した内容を復元しました。"); }
        else setSaveMessage("保存内容を読み込めませんでした。新しく確認を始められます。");
      }
    } catch { setSaveMessage("この環境では端末内保存を利用できません。チェックとコピーは利用できます。"); }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STOCKPILE_KEY, JSON.stringify(state)); }
    // 保存APIの失敗を、画面に通知するための状態更新。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setSaveMessage("保存できませんでした。ページを閉じる前にリストをコピーしてください。"); }
  }, [state, loaded]);
  function update(patch: Partial<StockpileState>, action: string) {
    setState(prev => ({ ...prev, ...patch, ...(action === "conditions" ? { statuses: {} } : {}) }));
    if (!started.current) { started.current = true; event("start"); }
    event(action);
    setMessage("");
  }
  const lists = stockpileLists(state);
  const water = state.people === null ? null : waterAmounts(state.people, state.days, state.water);
  async function copy() {
    try { await navigator.clipboard.writeText(stockpileText(state)); setMessage("リストをコピーしました。"); event("copy"); }
    catch { setShowList(true); setMessage("コピーできませんでした。下のテキストを選択してコピーしてください。"); }
  }
  function reset() {
    setState(emptyStockpile()); setShowList(false); setResetting(false); started.current = false;
    setMessage("入力内容をリセットしました。"); setSaveMessage(""); event("reset");
  }
  return <div className="stock-tool" aria-busy={!loaded}>
    <p className="stock-save" role="status">{saveMessage || "入力はこの端末のブラウザに自動保存されます。共有端末では利用後にリセットしてください。"}</p>
    <fieldset className="stock-conditions" disabled={!loaded}>
      <legend>まず、家庭の人数と備える日数を選ぶ</legend>
      <label>家庭の人数<select value={state.people ?? ""} onChange={e => update({ people: e.target.value ? Number(e.target.value) : null }, "conditions")}>
        <option value="">人数を選択</option>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}人</option>)}
      </select></label>
      <label>備える日数<select value={state.days} onChange={e => update({ days: Number(e.target.value) as 3 | 7 }, "conditions")}><option value={7}>7日分</option><option value={3}>3日分</option></select></label>
      <p>最低3日分、できれば1週間分が目安です。人数・日数を変えると確認状態は「未確認」に戻ります。手持ちの水の量は引き継ぎます。</p>
    </fieldset>
    {state.people === null ? <p className="stock-empty">人数を選ぶと、水の必要量と確認リストを表示します。</p> : <>
      <section className="stock-water" aria-labelledby="stock-water-heading">
        <div><h2 id="stock-water-heading">飲料・調理用の水</h2><p>1人1日3L × {state.people}人 × {state.days}日</p><p className="stock-amount">目安 <strong>{water!.required}</strong> L</p></div>
        <div><label htmlFor="stock-water-owned">家にある水（L）</label><input id="stock-water-owned" type="number" inputMode="decimal" min="0" max="10000" step="0.1" value={state.water ?? ""} placeholder="未確認" onChange={e => {
          const n = e.target.value === "" ? null : Number(e.target.value);
          if (n === null || (Number.isFinite(n) && n >= 0 && n <= 10000)) update({ water: n }, "inventory_update");
        }} /><p>例：2Lボトルが4本なら「8」。不明なら空欄のまま。</p>
          <p className="stock-water-result" aria-live="polite">{water!.shortage === null ? "手持ち量はまだ未確認です。" : water!.shortage > 0 ? `あと${water!.shortage}L（2Lボトルなら${Math.ceil(water!.shortage / 2)}本）` : "入力した水の量は目安を満たしています。"}</p>
        </div>
        <p className="stock-water-note">トイレなどの生活用水は含みません。飲める状態か、保管方法や期限も確認しましょう。<a href={STOCKPILE_SOURCES[1].url}>水の目安の出典</a></p>
      </section>
      <section aria-labelledby="stock-items-heading"><h2 id="stock-items-heading">家にあるものを確認する</h2><p>新しく買う前に、手持ちの物が使えるかを確認。ここでの「準備済み」は、ご自身の確認記録です。</p>
        <div className="stock-items">{STOCKPILE_ITEMS.map(item => <fieldset key={item.id} className="stock-item"><legend>{item.name}</legend><p>{item.note} <a href={STOCKPILE_SOURCES[item.source].url}>参考</a></p><div className="stock-options">{(Object.keys(labels) as StockStatus[]).map(status => <label key={status}><input type="radio" name={item.id} value={status} checked={(state.statuses[item.id] ?? "unknown") === status} onChange={() => update({ statuses: { ...state.statuses, [item.id]: status } }, "inventory_update")} />{labels[status]}</label>)}</div></fieldset>)}</div>
      </section>
      <section className="stock-summary" aria-labelledby="stock-summary-heading"><h2 id="stock-summary-heading">次に準備するものを整理する</h2>
        <p>要準備 {lists.needed.length}項目 ／ 未確認 {lists.unknown.length}項目。備蓄全体の充足率や安全性を示す数字ではありません。</p>
        <button type="button" onClick={() => { setShowList(true); event("list_view", { needed_count: lists.needed.length, unchecked_count: lists.unknown.length }); }}>買い足し・確認リストを見る</button>
        <div className={showList ? "stock-list" : "stock-list stock-print-only"}>
          <h3>買い足す・準備するもの</h3><ul>{lists.needed.length ? lists.needed.map(item => <li key={item}>{item}</li>) : <li>現在の入力ではありません。</li>}</ul>
          <h3>まだ確認していないもの</h3><ul>{lists.unknown.length ? lists.unknown.map(item => <li key={item}>{item}</li>) : <li>現在の入力ではありません。</li>}</ul>
          <div className="stock-actions"><button type="button" onClick={copy}>リストをコピー</button><button type="button" onClick={() => { event("print"); window.print(); }}>印刷する</button></div>
          <details><summary>コピー用テキスト</summary><textarea aria-label="コピー用の備蓄リスト" readOnly value={stockpileText(state)} rows={12} /></details>
        </div>
      </section>
    </>}
    <p role="status">{message}</p>
    <div className="stock-reset">{resetting ? <><p>保存した内容も含めてリセットしますか？</p><button type="button" onClick={reset}>リセットする</button><button type="button" onClick={() => setResetting(false)}>キャンセル</button></> : <button type="button" disabled={!loaded} onClick={() => setResetting(true)}>入力・保存内容をリセット</button>}</div>
  </div>;
}
