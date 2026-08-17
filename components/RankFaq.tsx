// 「よくある質問」セクション（rk- アコーディオン）。全国版・都道府県別の
// ランキングページで同一マークアップを共有する。空なら何も描画しない
// （呼び出し側で length チェックをしない。RankLinkList と同じ規約）。
import { Info } from "lucide-react";

export default function RankFaq({ faq }: { faq: { q: string; a: string }[] }) {
  if (faq.length === 0) return null;
  return (
    <section className="rk-section">
      <div className="rk-section-head">
        <span className="rk-section-icon"><Info size={20} aria-hidden="true" /></span>
        <div className="rk-section-heading">
          <h2 className="rk-h2">よくある質問</h2>
        </div>
      </div>
      <div className="rk-faq">
        {faq.map(({ q, a }, i) => (
          <details key={i} className="rk-faq-item">
            <summary className="rk-faq-q">{q}</summary>
            <p className="rk-faq-a">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
