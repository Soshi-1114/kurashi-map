// 「この自治体の特徴」リスト（lib/highlights.ts の抽出結果を表示する server component）。
// ラベルチップ＋客観表現の1文を罫線区切りで密に並べる（巨大カードにしない）。
import type { Highlight } from "@/lib/highlights";

export function HighlightList({ highlights }: { highlights: Highlight[] }) {
  if (highlights.length === 0) return null;
  return (
    <ul className="ad-highlights">
      {highlights.map((h) => (
        <li key={h.key} className="ad-highlight">
          <span className="ad-highlight-k">{h.label}</span>
          <span className="ad-highlight-text">{h.text}</span>
        </li>
      ))}
    </ul>
  );
}
