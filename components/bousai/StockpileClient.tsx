"use client";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { QUICK_ENTRY_VERSION, takeQuickEntry, type QuickEntry } from "@/lib/quickEntry";
import { STOCKPILE_ITEMS, STOCKPILE_KEY, STOCKPILE_SOURCES, emptyStockpile, parseStockpile, stockpileLists, stockpileText, waterAmounts, type StockpileState, type StockStatus } from "@/lib/stockpile";

const labels: Record<StockStatus, string> = { unknown: "未確認", needed: "要準備", ready: "準備済み" };
function event(action: string, detail: Record<string, unknown> = {}) {
  const from = new URLSearchParams(window.location.search).get("from");
  const entryPlacement = from === "area" || from === "hazard-map" ? from : "direct";
  track(`stockpile_${action}`, { measurement_version: QUICK_ENTRY_VERSION, entry_placement: entryPlacement, ...detail });
}
export default function StockpileClient() {
  const [state, setState] = useState<StockpileState>(emptyStockpile);
  const [loaded, setLoaded] = useState(false);
  const [waterInput, setWaterInput] = useState("");
  const [waterError, setWaterError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [message, setMessage] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showList, setShowList] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<Extract<QuickEntry, { tool: "stockpile" }> | null>(null);
  const restored = useRef(false);
  const started = useRef(false);
  const copyDetails = useRef<HTMLDetailsElement>(null);
  const copyText = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = takeQuickEntry("stockpile", window.location.search);
    // SSRと初回描画を一致させ、マウント後に端末内の保存内容を復元する。
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(STOCKPILE_KEY);
      if (raw) {
        if (draft) setPendingDraft(draft);
        const saved = parseStockpile(raw);
        if (saved) { setState(saved); setWaterInput(saved.water?.toString() ?? ""); setSaveMessage("この端末に保存した内容を復元しました。"); }
        else setSaveMessage("保存内容を読み込めませんでした。新しく確認を始められます。");
      } else if (draft) {
        setState({ ...emptyStockpile(), people: draft.people, days: draft.days });
        started.current = true;
        event("start");
      }
    } catch {
      setSaveMessage("この環境では端末内保存を利用できません。チェックとコピーは利用できます。");
      if (draft) { setState({ ...emptyStockpile(), people: draft.people, days: draft.days }); started.current = true; event("start"); }
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  // 保存はユーザーが入力・リセットした時だけ行う。読み込み時には、
  // 破損データや将来形式のデータを初期値で上書きしない。
  function save(next: StockpileState) {
    try {
      localStorage.setItem(STOCKPILE_KEY, JSON.stringify(next));
      setSaveMessage("この端末に保存しました。");
    } catch {
      setSaveMessage("保存できませんでした。ページを閉じる前にリストをコピーしてください。");
    }
  }
  function update(patch: Partial<StockpileState>, action: string) {
    const next = { ...state, ...patch, ...(action === "conditions" ? { statuses: {} } : {}) };
    setState(next);
    save(next);
    if (!started.current) { started.current = true; event("start"); }
    event(action);
    setMessage("");
  }
  const lists = stockpileLists(state);
  const water = state.people === null ? null : waterAmounts(state.people, state.days, state.water);
  async function copy() {
    try { await navigator.clipboard.writeText(stockpileText(state)); setMessage("リストをコピーしました。"); event("copy"); }
    catch {
      setShowList(true);
      if (copyDetails.current) copyDetails.current.open = true;
      copyText.current?.focus();
      copyText.current?.select();
      setMessage("コピーできませんでした。下のテキストを選択してコピーしてください。");
    }
  }
  function reset() {
    const next = emptyStockpile();
    setState(next);
    setWaterInput("");
    setWaterError("");
    try {
      localStorage.removeItem(STOCKPILE_KEY);
      setSaveMessage("この端末の保存内容を削除しました。");
    } catch {
      setSaveMessage("保存内容を削除できませんでした。このブラウザのサイトデータ設定から削除してください。");
    }
    setShowList(false);
    setResetting(false);
    setPendingDraft(null);
    started.current = false;
    setMessage("入力内容をリセットしました。");
    event("reset");
  }
  return <div className="stock-tool" aria-busy={!loaded}>
    <p className="stock-scope">自宅で過ごすための備蓄の目安です。避難できるか・在宅避難できるかは判定しません。災害時は自治体の避難情報に従ってください。</p>
    <p className="stock-save">入力はこの端末のブラウザに自動保存されます。共有端末では利用後にリセットしてください。</p>
    <p className="stock-save" role="status">{saveMessage}</p>
    {pendingDraft && <div className="stock-scope"><p>この端末に保存内容があるため、入口の条件はまだ適用していません。入口では{pendingDraft.people}人・{pendingDraft.days}日分を選んでいます。</p><p>条件を変更すると各項目は「未確認」に戻ります。手持ちの水の量は引き継ぎます。</p><button type="button" onClick={() => { update({ people: pendingDraft.people, days: pendingDraft.days }, "conditions"); setPendingDraft(null); setShowList(false); }}>入口で選んだ条件に変更する</button><button type="button" onClick={() => setPendingDraft(null)}>入口の条件を適用しない</button></div>}
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
        <div><label htmlFor="stock-water-owned">家にある水（L）</label><input id="stock-water-owned" type="number" inputMode="decimal" min="0" max="10000" step="any" value={waterInput} placeholder="未確認" aria-invalid={Boolean(waterError)} aria-describedby={waterError ? "stock-water-error" : undefined} onChange={e => {
          const raw = e.target.value;
          const n = raw === "" ? null : Number(raw);
          const invalid = e.target.validity.badInput || (n !== null && (!Number.isFinite(n) || n < 0 || n > 10000));
          setWaterInput(raw);
          setWaterError(invalid ? "水の量は0〜10,000Lの数値で入力してください。確認するまで手持ち量は未確認として扱います。" : "");
          update({ water: invalid ? null : n }, "inventory_update");
        }} />{waterError && <p id="stock-water-error" role="alert">{waterError}</p>}<p>例：2Lボトルが4本なら「8」。不明なら空欄のまま。</p>
          <p className="stock-water-result" aria-live="polite">{water!.shortage === null ? "手持ち量はまだ未確認です。" : water!.shortage > 0 ? `あと${water!.shortage}L（2Lボトルなら${Math.ceil(water!.shortage / 2)}本）` : "入力した水の量は目安を満たしています。"}</p>
        </div>
        <p className="stock-water-note">トイレなどの生活用水は含みません。不足量は0.1L単位で切り上げています。飲める状態か、保管方法や期限も確認しましょう。<a href={STOCKPILE_SOURCES[1].url}>水の目安の出典</a></p>
      </section>
      <section aria-labelledby="stock-items-heading"><h2 id="stock-items-heading">家にあるものを確認する</h2><p>新しく買う前に、手持ちの物が使えるかを確認。ここでの「準備済み」は、ご自身の確認記録です。</p>
        <div className="stock-items">{STOCKPILE_ITEMS.map(item => <fieldset key={item.id} className="stock-item"><legend>{item.name}</legend><p>{item.note} <a href={STOCKPILE_SOURCES[item.source].url} aria-label={`${item.name}の参考情報`}>参考</a></p><div className="stock-options">{(Object.keys(labels) as StockStatus[]).map(status => <label key={status}><input type="radio" name={item.id} value={status} checked={(state.statuses[item.id] ?? "unknown") === status} onChange={() => update({ statuses: { ...state.statuses, [item.id]: status } }, "inventory_update")} />{labels[status]}</label>)}</div></fieldset>)}</div>
      </section>
      <section className="stock-summary" aria-labelledby="stock-summary-heading"><h2 id="stock-summary-heading">次に準備するものを整理する</h2>
        <p>要準備 {lists.needed.length}項目 ／ 未確認 {lists.unknown.length}項目。備蓄全体の充足率や安全性を示す数字ではありません。</p>
        <p className="stock-print-context">{state.people}人・{state.days}日分。飲料・調理用の水の目安は{water!.required}L、手持ちは{state.water === null ? "未確認" : `${state.water}L`}です。在宅備蓄の目安であり、避難可否は判定しません。</p>
        <button type="button" aria-expanded={showList} aria-controls="stock-result-list" onClick={() => {
          if (showList) return;
          setShowList(true);
          event("list_view", { needed_count: lists.needed.length, unchecked_count: lists.unknown.length });
        }}>買い足し・確認リストを見る</button>
        <div id="stock-result-list" className={showList ? "stock-list" : "stock-list stock-print-only"}>
          <h3>買い足す・準備するもの</h3><ul>{lists.needed.length ? lists.needed.map(item => <li key={item}>{item}</li>) : <li>現在の入力ではありません。</li>}</ul>
          <h3>まだ確認していないもの</h3><ul>{lists.unknown.length ? lists.unknown.map(item => <li key={item}>{item}</li>) : <li>現在の入力ではありません。</li>}</ul>
          <div className="stock-actions"><button type="button" onClick={copy}>リストをコピー</button><button type="button" onClick={() => { event("print"); window.print(); }}>印刷する</button></div>
          <details ref={copyDetails}><summary>コピー用テキスト</summary><textarea ref={copyText} aria-label="コピー用の備蓄リスト" readOnly value={stockpileText(state)} rows={12} /></details>
        </div>
      </section>
    </>}
    <p role="status">{message}</p>
    <div className="stock-reset">{resetting ? <><p>保存した内容も含めてリセットしますか？</p><button type="button" onClick={reset}>リセットする</button><button type="button" onClick={() => setResetting(false)}>キャンセル</button></> : <button type="button" disabled={!loaded} onClick={() => setResetting(true)}>入力・保存内容をリセット</button>}</div>
  </div>;
}
