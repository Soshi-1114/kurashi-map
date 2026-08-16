"use client";

// 電気料金シミュレーター（/denki の client island）。
// 骨格・説明・前提条件は SSG 側（app/denki/page.tsx）が持ち、ここは
// 入力状態と試算結果の描画だけを担う。?code=（自治体コード）があれば
// 供給エリアを初期選択する（useSearchParams のため親で Suspense に包む）。

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DENKI_AREAS,
  DENKI_AREA_LABELS,
  areaForMuni,
  type DenkiArea,
} from "@/lib/denki";
import { AMPERES, DENKI_PLANS, type Ampere } from "@/lib/denkiPlans";
import {
  HOUSEHOLD_KWH,
  HOUSEHOLD_SIZES,
  compareOffers,
  defaultAmpere,
  type HouseholdSize,
} from "@/lib/denkiSim";
import { yen } from "@/lib/format";
import { denkiOfferUrl } from "@/lib/monetization";
import {
  trackDenkiSimulate,
  trackDenkiOfferImpression,
  trackDenkiOfferClick,
} from "@/lib/analytics";

export default function DenkiSimulator() {
  const params = useSearchParams();
  const code = params.get("code");
  const preset = code ? areaForMuni(code) : null;

  const [area, setArea] = useState<DenkiArea>(preset?.area ?? "tokyo");
  const [householdSize, setHouseholdSize] = useState<HouseholdSize>(2);
  const [ampere, setAmpere] = useState<Ampere>(defaultAmpere(2));
  // 使用量の上書き（空文字 = 世帯人数からの目安を使う）
  const [kwhInput, setKwhInput] = useState<string>("");

  const overridden = kwhInput.trim() !== "" && Number(kwhInput) > 0;
  const kwh = overridden ? Number(kwhInput) : HOUSEHOLD_KWH[householdSize];

  // このエリアの baseline が最低料金制なら契約アンペアの概念がない
  const baseline = DENKI_PLANS.plans.find((p) => p.kind === "baseline" && p.areas[area]);
  const isAmpereArea = baseline?.areas[area]?.basic.type === "ampere";

  // プラン ~15 件・段階 3 つの計算なのでメモ化しない（毎レンダーで十分速い）
  const rows = compareOffers(DENKI_PLANS, area, kwh, ampere).map((r) => ({
    ...r,
    link: r.kind === "offer" ? denkiOfferUrl(r.offerId, r.officialUrl) : null,
  }));
  const offerCount = rows.filter((r) => r.link).length;
  const hasAffiliate = rows.some((r) => r.link?.isAffiliate);

  // シミュレーション実行の計測（連続入力は 1s debounce で確定値に寄せ、初回マウント時は送らない）
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      trackDenkiSimulate({
        area,
        householdSize,
        kwh,
        kwhOverridden: overridden,
        ampere,
        municipalityCode: code ?? undefined,
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [area, householdSize, kwh, ampere, overridden, code]);

  // 結果リストの表示計測（エリアごとに1回。掲載オファーが無い間は送らない）
  const impressedArea = useRef<DenkiArea | null>(null);
  useEffect(() => {
    if (offerCount === 0 || impressedArea.current === area) return;
    impressedArea.current = area;
    trackDenkiOfferImpression({ area, offerCount, hasAffiliate });
  }, [area, offerCount, hasAffiliate]);

  return (
    <div className="dnk-sim">
      {preset?.altArea && (
        <p className="dnk-boundary" role="note">
          この自治体は供給エリアが地区で分かれます（{preset.note}）。お住まいの地区に合わせてエリアを選んでください。
        </p>
      )}

      <div className="dnk-controls">
        <label className="dnk-field">
          <span className="dnk-label">供給エリア</span>
          <select value={area} onChange={(e) => setArea(e.target.value as DenkiArea)}>
            {DENKI_AREAS.map((a) => (
              <option key={a} value={a}>
                {DENKI_AREA_LABELS[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="dnk-field">
          <span className="dnk-label">世帯人数</span>
          <select
            value={householdSize}
            onChange={(e) => {
              const size = Number(e.target.value) as HouseholdSize;
              setHouseholdSize(size);
              setAmpere(defaultAmpere(size));
            }}
          >
            {HOUSEHOLD_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}人
              </option>
            ))}
          </select>
        </label>

        {isAmpereArea && (
          <label className="dnk-field">
            <span className="dnk-label">契約アンペア</span>
            <select value={ampere} onChange={(e) => setAmpere(Number(e.target.value) as Ampere)}>
              {AMPERES.map((a) => (
                <option key={a} value={a}>
                  {a}A
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="dnk-field">
          <span className="dnk-label">月間使用量（kWh）</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={`目安 ${HOUSEHOLD_KWH[householdSize]}`}
            value={kwhInput}
            onChange={(e) => setKwhInput(e.target.value)}
          />
        </label>
      </div>

      <p className="dnk-kwh-note">
        使用量を入力しない場合は、世帯人数別の平均値（{HOUSEHOLD_KWH[householdSize]}kWh/月）で試算します。
      </p>

      {hasAffiliate && (
        <p className="dnk-ad-note">当ページはアフィリエイト広告を含みます。</p>
      )}

      <ul className="dnk-results">
        {rows.map((r, i) => (
          <li key={r.offerId} className={`dnk-row${r.kind === "baseline" ? " dnk-row-baseline" : ""}`}>
            <div className="dnk-row-head">
              <span className="dnk-company">
                {r.company}
                {r.link?.isAffiliate && <span className="dnk-pr">PR</span>}
              </span>
              <span className="dnk-plan">{r.planName}</span>
            </div>
            <div className="dnk-row-amount">
              <strong className="dnk-monthly">{yen(r.monthlyYen)}</strong>
              <span className="dnk-per">/月（目安）</span>
              {r.diffYen !== null && (
                <span className={`dnk-diff${r.diffYen < 0 ? " dnk-diff-minus" : ""}`}>
                  大手従量電灯比 {r.diffYen < 0 ? "−" : "+"}
                  {yen(Math.abs(r.diffYen))}
                </span>
              )}
              {r.kind === "baseline" && <span className="dnk-baseline-tag">比較の基準</span>}
            </div>
            {r.notes && r.notes.length > 0 && (
              <ul className="dnk-notes">
                {r.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {r.link && (
              <a
                className="dnk-link"
                href={r.link.url}
                target="_blank"
                rel={r.link.isAffiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                onClick={() =>
                  trackDenkiOfferClick({
                    offerId: r.offerId,
                    area,
                    isAffiliate: r.link!.isAffiliate,
                    position: i,
                  })
                }
              >
                公式サイトで詳細を見る
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
