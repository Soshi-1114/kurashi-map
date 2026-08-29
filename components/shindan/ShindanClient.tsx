"use client";

// 街診断のインタラクティブ部分。質問（6軸の重み）と地方の選択状態を URL クエリ
// （?w=210120&r=kanto）と同期し、結果を共有・ブックマーク可能にする（/compare の
// ?codes= と同方針）。スコア計算はサーバーで前計算した軸スコア（ShindanEntry）の
// 重み付き平均のみで、フルデータはクライアントに配らない。
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, ArrowUpRight } from "lucide-react";
import {
  SHINDAN_AXES, EMPTY_WEIGHTS, hasAnyWeight, runShindan,
  encodeWeights, decodeWeights, decodeRegions,
  type ShindanEntry, type ShindanWeights, type ShindanWeight,
} from "@/lib/shindan";
import { REGIONS, getPrefByCode } from "@/lib/prefs";
import { trackShindanRun, trackShindanResultClick } from "@/lib/analytics";

const WEIGHT_LABELS: { value: ShindanWeight; label: string }[] = [
  { value: 0, label: "こだわらない" },
  { value: 1, label: "やや重視" },
  { value: 2, label: "とても重視" },
];

export default function ShindanClient({ entries }: { entries: ShindanEntry[] }) {
  // 初期値はマウント後に URL から復元する（SSG プリレンダーとの hydration 不整合を
  // 避けるため初期レンダーでは読まない。地図フィルタと同じパターン）。
  const [weights, setWeights] = useState<ShindanWeights>(EMPTY_WEIGHTS);
  const [regions, setRegions] = useState<string[]>([]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = decodeWeights(params.get("w"));
    const r = decodeRegions(params.get("r"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasAnyWeight(w)) setWeights(w);
    if (r.length > 0) setRegions(r);
  }, []);

  // 状態変更を URL に反映（他パラメータは保持）。
  const syncUrl = (w: ShindanWeights, r: string[]) => {
    const params = new URLSearchParams(window.location.search);
    if (hasAnyWeight(w)) params.set("w", encodeWeights(w));
    else params.delete("w");
    if (r.length > 0) params.set("r", r.join(","));
    else params.delete("r");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const setWeight = (key: (typeof SHINDAN_AXES)[number]["key"], value: ShindanWeight) => {
    const next = { ...weights, [key]: value };
    setWeights(next);
    syncUrl(next, regions);
  };

  const toggleRegion = (key: string) => {
    const next = regions.includes(key) ? regions.filter((k) => k !== key) : [...regions, key];
    setRegions(next);
    syncUrl(weights, next);
  };

  const { results, eligibleCount } = useMemo(
    () => runShindan(entries, weights, regions),
    [entries, weights, regions],
  );

  // 診断実行の計測（重み・地方の組み合わせが変わるたびに1回。apply_filter と同方針）。
  const active = hasAnyWeight(weights);
  useEffect(() => {
    if (!active) return;
    trackShindanRun({ weights: encodeWeights(weights), regions: regions.join(","), resultCount: eligibleCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights, regions]);

  return (
    <div className="sd-root">
      <section className="sd-questions" aria-label="重視する条件">
        {SHINDAN_AXES.map((axis) => (
          <div key={axis.key} className="sd-question">
            <div className="sd-question-text">
              <p className="sd-question-q">{axis.question}</p>
              <p className="sd-question-basis">測り方: {axis.basis}</p>
            </div>
            <div className="filter-segments" role="group" aria-label={axis.question}>
              {WEIGHT_LABELS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  className={`filter-seg ${weights[axis.key] === w.value ? "is-active" : ""}`}
                  aria-pressed={weights[axis.key] === w.value}
                  onClick={() => setWeight(axis.key, w.value)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="sd-question">
          <div className="sd-question-text">
            <p className="sd-question-q">探すエリア（未選択なら全国）</p>
          </div>
          <div className="sd-regions" role="group" aria-label="探す地方">
            {REGIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`filter-seg ${regions.includes(r.key) ? "is-active" : ""}`}
                aria-pressed={regions.includes(r.key)}
                onClick={() => toggleRegion(r.key)}
              >
                {r.nameJa}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!active ? (
        <p className="sd-empty">重視する条件を1つ以上選ぶと、条件に合う市区町村トップ10を表示します。</p>
      ) : results.length === 0 ? (
        <p className="sd-empty">
          条件に合う自治体が見つかりませんでした。重視する条件を減らすか、エリアを広げてお試しください（重視した指標のデータがある自治体のみが対象です）。
        </p>
      ) : (
        <section className="sd-results" aria-label="診断結果" aria-live="polite">
          <h2 className="sd-results-h">
            あなたの条件に合う市区町村 トップ{results.length}
            <span className="sd-results-sub">該当 {eligibleCount.toLocaleString()} 自治体から適合スコア順</span>
          </h2>
          <ol className="sd-list">
            {results.map((r, i) => {
              const prefName = getPrefByCode(r.entry.code)?.nameJa ?? "";
              return (
                <li key={r.entry.code} className="sd-row">
                  <span className="sd-rank">{i + 1}</span>
                  <div className="sd-row-main">
                    <Link
                      href={`/area/${r.entry.pref}/${r.entry.code}`}
                      className="sd-town"
                      onClick={() => trackShindanResultClick(r.entry.code, i)}
                    >
                      {r.entry.name}
                      <small className="sd-pref"><MapPin size={12} aria-hidden="true" />{prefName}</small>
                    </Link>
                    <p className="sd-axes">
                      {r.axisStars.map((a) => (
                        <span key={a.key} className="sd-axis">
                          {a.label} {"★".repeat(a.stars)}
                        </span>
                      ))}
                    </p>
                  </div>
                  <span className="sd-score">
                    <strong>{r.score}</strong>
                    <small>適合スコア</small>
                  </span>
                  <Link href={`/compare?codes=${r.entry.code}`} className="sd-compare" aria-label={`${r.entry.name}を比較ページで見る`}>
                    比較<ArrowUpRight size={12} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="sd-note">
            適合スコアは、重視した軸の住みやすさ評価（1〜5・政府統計の実データから算出した目安）を重み付き平均して100点換算した値です。重視した指標のデータがない自治体は対象外です。アクセス・生活インフラは施設の実数で測るため、規模の大きい自治体ほど高く出る傾向があります。
          </p>
        </section>
      )}
    </div>
  );
}
