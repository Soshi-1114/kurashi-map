"use client";

/** 例示や初期表示では入力しない。本人が人数を選んだ時だけ結果を生成する。 */
export default function QuickPeopleInput({ label, value, max, onChange }: {
  label: string;
  value: number;
  max: 5 | 20;
  onChange: (people: number) => void;
}) {
  return <fieldset className="quick-people">
    <legend>{label}</legend>
    <div className="quick-people-options">
      {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)}>{n}人</button>)}
      {max > 5 && <label className="quick-people-more">6人以上
        <select aria-label={`${label}（6人以上）`} value={value > 5 ? value : ""} onChange={e => { const n = Number(e.target.value); if (n) onChange(n); }}>
          <option value="">選択</option>
          {Array.from({ length: max - 5 }, (_, i) => i + 6).map(n => <option key={n} value={n}>{n}人</option>)}
        </select>
      </label>}
    </div>
  </fieldset>;
}
