"use client";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useImpressionOnce } from "@/lib/useImpression";
import type { FurusatoChoice } from "@/lib/furusatoChoices";
import type { FurusatoLinkInfo } from "@/lib/monetization";
import { FurusatoLink } from "./FurusatoLink";
import "./affiliate-context.css";

const params = { placement: "ranking", cta_variant: "donation-select-v1", measurement_version: "2026-10-31" };
export default function FurusatoPicker({ choices, fallback }: { choices: FurusatoChoice[]; fallback: FurusatoLinkInfo }) {
  const [code, setCode] = useState("");
  const rendered = useRef(false);
  const ref = useImpressionOnce<HTMLElement>("furusato_picker_view", params);
  useEffect(() => { if (!rendered.current) { rendered.current = true; track("furusato_picker_render", params); } }, []);
  const selected = choices.find(c => c.code === code);
  return <section ref={ref} className="affiliate-context affiliate-picker" aria-label="広告：ふるさと納税で地域を応援する">
    <h2>気になった自治体を、ふるさと納税で応援する</h2>
    <p>このページに掲載した最初の10自治体から、ふるなびで確認できる寄付先を選べます。ランキングは寄付先の推奨順位ではありません。</p>
    <label>応援したい自治体<select value={code} onChange={e => { setCode(e.target.value); if (e.target.value) track("furusato_picker_select", { ...params, municipality_code: e.target.value }); }}><option value="">自治体を選択</option>{choices.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></label>
    {selected ? <FurusatoLink link={selected.link} targetName={selected.name} municipalityCode={selected.code} placement="ranking" ctaVariant="donation-select-v1" /> : <p className="affiliate-context-note">広告・自治体を選ぶと、ふるなびの自治体ページへ進むボタンが表示されます。行政区は親の市を表示します。</p>}
    <noscript>
      <p>広告・<a href={fallback.url} target="_blank" rel="sponsored nofollow noopener" referrerPolicy="no-referrer-when-downgrade">ふるなびで寄付先を探す</a>（ふるなびトップへ移動します）</p>
      {fallback.impressionPixel && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallback.impressionPixel} width={1} height={1} alt="" />
      )}
    </noscript>
  </section>;
}
