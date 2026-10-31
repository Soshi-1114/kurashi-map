"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useImpressionOnce } from "@/lib/useImpression";
import { track } from "@/lib/analytics";
import { waterAmounts, STOCKPILE_SOURCES } from "@/lib/stockpile";
import { QUICK_ENTRY_VERSION, saveQuickEntry } from "@/lib/quickEntry";
import "@/components/tools/quick-tools.css";

export default function StockpileEntry({ placement }: { placement: "hazard-map" | "area" }) {
  const [people, setPeople] = useState(0);
  const [days, setDays] = useState<3 | 7>(7);
  const interacted = useRef(false);
  const calculated = useRef(false);
  const params = { placement, measurement_version: QUICK_ENTRY_VERSION, cta_variant: "water-inline-v1" };
  const ref = useImpressionOnce<HTMLElement>("stockpile_entry_view", params);
  function changed(nextPeople: number) {
    if (!interacted.current) { interacted.current = true; track("stockpile_quick_interact", params); }
    if (nextPeople && !calculated.current) { calculated.current = true; track("stockpile_quick_result_view", params); }
  }
  const required = people ? waterAmounts(people, days, null).required : null;
  return <section ref={ref} className="quick-tool quick-tool--stockpile" aria-label="家庭の備蓄を試す">
    <h3>わが家に必要な水は何L？</h3>
    <p>まずは人数と日数から、飲料・調理用の水の目安を確認できます。</p>
    <div className="quick-tool-fields"><label>備蓄を調べる家庭の人数<select value={people || ""} onChange={e => { const n = Number(e.target.value); setPeople(n); changed(n); }}><option value="">人数を選択</option>{Array.from({ length: 20 }, (_, i) => <option key={i} value={i + 1}>{i + 1}人</option>)}</select></label><label>備蓄を調べる日数<select value={days} onChange={e => { setDays(Number(e.target.value) as 3 | 7); changed(people); }}><option value={7}>7日分</option><option value={3}>3日分</option></select></label></div>
    <div className="quick-tool-result" role="status">{required !== null ? <><strong>{required}L</strong>（2Lボトルなら{Math.ceil(required / 2)}本）<p className="quick-tool-note">1人1日3L × {people}人 × {days}日。手持ちを差し引く前の必要量です。</p></> : <p>人数を選ぶと、水の目安を表示します。</p>}</div>
    <p className="quick-tool-note">在宅備蓄の目安です。生活用水は含まず、避難の判断には使えません。<a href={STOCKPILE_SOURCES[1].url}>水の目安の出典</a></p>
    <Link prefetch={false} className="quick-tool-action" href={`/bousai/stockpile?from=${placement}${people ? "&quick=1" : ""}`} onClick={() => { if (people) saveQuickEntry({ tool: "stockpile", people, days, from: placement }); track("stockpile_entry_click", params); }}>食品・日用品もチェックする</Link>
    <noscript><p>この場での計算にはJavaScriptが必要です。詳しい備蓄ガイドはリンク先で確認できます。</p></noscript>
  </section>;
}
