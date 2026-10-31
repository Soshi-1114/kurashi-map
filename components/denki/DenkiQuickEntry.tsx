"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { type DenkiArea } from "@/lib/denki";
import { track } from "@/lib/analytics";
import { useImpressionOnce } from "@/lib/useImpression";
import { QUICK_ENTRY_VERSION, saveQuickEntry } from "@/lib/quickEntry";
import { denkiHref } from "@/lib/siteNav";
import "@/components/tools/quick-tools.css";

export type QuickDenkiArea = { area: DenkiArea; label: string; estimates: { people: number; kwh: number; ampere: number | null; yen: number }[] };
export default function DenkiQuickEntry({ code, name, areas, note, asOf }: { code: string; name: string; areas: QuickDenkiArea[]; note?: string; asOf: string }) {
  const [people, setPeople] = useState(0);
  const [area, setArea] = useState(areas[0].area);
  const interacted = useRef(false);
  const calculated = useRef(false);
  const params = { municipality_code: code, placement: "area-overview", cta_variant: "inline-v1", measurement_version: QUICK_ENTRY_VERSION };
  const ref = useImpressionOnce<HTMLElement>("denki_entry_view", { ...params, area: areas[0].area });
  function changed(nextPeople: number) {
    if (!interacted.current) { interacted.current = true; track("denki_quick_interact", params); }
    if (nextPeople && !calculated.current) { calculated.current = true; track("denki_quick_result_view", params); }
  }
  const selected = areas.find(a => a.area === area)!;
  const result = selected.estimates.find(e => e.people === people);
  const href = denkiHref(code, "area_detail") + (result ? "&quick=1" : "");
  return <section ref={ref} id="denki-quick" className="quick-tool" aria-labelledby={`denki-quick-${code}`}>
    <h2 id={`denki-quick-${code}`}>人数から、電気代の目安を確認</h2>
    <p>{name}の供給エリアの、大手電力の従量電灯プランで試算します。</p>
    {areas.length > 1 && <p className="quick-tool-note">地区によって供給エリアが分かれます。お住まいの地区に合わせて選んでください。{note}</p>}
    <div className="quick-tool-fields">
      {areas.length > 1 ? <label>供給エリア<select value={area} onChange={e => { setArea(e.target.value as DenkiArea); changed(people); }}>{areas.map(a => <option key={a.area} value={a.area}>{a.label}</option>)}</select></label> : <p>{selected.label}</p>}
      <label>電気代を調べる世帯人数<select value={people || ""} onChange={e => { const n = Number(e.target.value); setPeople(n); changed(n); }}><option value="">人数を選択</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}人</option>)}</select></label>
    </div>
    <div className="quick-tool-result" role="status">{result ? <><strong>{result.yen.toLocaleString()}円</strong>／月（目安）<p className="quick-tool-note">月{result.kwh}kWh・{result.ampere ? `${result.ampere}A` : "最低料金制"}で試算。人数別の全国平均使用量を使用しています。</p></> : <p>人数を選ぶと、ここに月額の目安を表示します。</p>}</div>
    <p className="quick-tool-note">基本料金・電力量料金の目安です。燃料費調整額・再エネ賦課金・割引は含みません。単価確認：{asOf}。</p>
    <Link prefetch={false} className="quick-tool-action" href={href} onClick={() => { if (result) saveQuickEntry({ tool: "denki", people, area, code, from: "area_detail" }); track("denki_entry_click", { ...params, area }); }}>使用量を変えて詳しく試算する</Link>
    <p className="quick-tool-note">6人以上の方や使用量が分かる方も、詳細ページで入力できます。</p>
    <noscript><p>この場での試算にはJavaScriptが必要です。詳細ページの人数別早見表もご覧いただけます。</p></noscript>
  </section>;
}
