"use client";

// 自治体比較のインタラクティブ部分（ピッカー＋比較テーブル）。
// URL の ?codes=11203,11201 を単一の情報源とし、追加・削除は router.replace で
// URL に同期する（共有・ブックマーク可能）。フルデータは選択時に /api/muni/[code]
// から取得する（トップ地図の詳細パネルと同じ2段階配信方針）。
// 表示は2構造: PC=指標×自治体のテーブル、SP=指標単位の縦型リスト（CSSで切替）。
// 単一テーブルの display 上書きはテーブルセマンティクスを壊すため採らない。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Municipality, MuniSummary } from "@/lib/types";
import { COMPARE_ROWS, COMPARE_GROUPS, type CompareRowDef, type NationalAverages } from "@/lib/compareMetrics";
import { useMuniCombobox } from "@/lib/useMuniCombobox";
import { muniContextLabel } from "@/lib/muniLabel";
import { barWidthPct } from "@/lib/format";
import { getPrefBySlug } from "@/lib/prefs";
import { trackCompareStart } from "@/lib/analytics";
import { MAX_COMPARE } from "@/lib/siteNav";

// 実体は lib/siteNav.ts（送り出す側のサーバーコンポーネントからも参照するため）。
// 既存の import 元を変えずに済むよう、ここから再 export する。
export { MAX_COMPARE };

/** 平均列の種類。県平均は選択自治体がすべて同一県のときだけ選べる。 */
type AvgKind = "national" | "pref";

/**
 * 1行ぶんのバー用数値をまとめて計算する（テーブルとモバイル縦型リストで共有）。
 * cells は resolved と同じ並び。numericValue を持たない行は全て null（バーなし）。
 */
function computeRow(row: CompareRowDef, resolved: Array<Municipality | null>, averages: NationalAverages) {
  const cells = row.numericValue
    ? resolved.map((m) => (m ? row.numericValue!(m) : null))
    : resolved.map(() => null);
  const avgValue = row.nationalAvgValue?.(averages) ?? null;
  const rowMax = row.numericValue
    ? Math.max(...cells.filter((v): v is number => v != null), avgValue ?? 0, 1)
    : 1;
  return { cells, avgValue, rowMax };
}

/** ?codes= を検証済みコード配列に正規化（5桁数字・実在・重複除去・最大3件）。 */
function parseCodes(raw: string | null, known: Set<string>): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const c of raw.split(",")) {
    const code = c.trim();
    if (!/^\d{5}$/.test(code) || !known.has(code) || out.includes(code)) continue;
    out.push(code);
    if (out.length >= MAX_COMPARE) break;
  }
  return out;
}

type DetailState = Municipality | "loading" | "error";

export default function CompareClient({
  munis,
  nationalAverages,
  prefAverages,
}: {
  munis: MuniSummary[];
  nationalAverages: NationalAverages;
  /** 県スラッグ → 県平均。選択自治体がすべて同一県のとき切替表示に使う */
  prefAverages: Record<string, NationalAverages>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const byCode = useMemo(() => new Map(munis.map((m) => [m.code, m])), [munis]);
  const known = useMemo(() => new Set(munis.map((m) => m.code)), [munis]);
  const codes = useMemo(() => parseCodes(searchParams.get("codes"), known), [searchParams, known]);

  // 他ページからの送客を1回だけ計測する（?from=ranking_row 等）。
  // ランキング表の各行をクライアント化すると100件ぶん hydration が増えるため、
  // リンクは素のままにして着地側のここで数える。codes 変更（router.replace）では
  // 再発火させたくないので ref でガードする。
  const fromFired = useRef(false);
  useEffect(() => {
    if (fromFired.current) return;
    const from = searchParams.get("from");
    if (!from) return;
    fromFired.current = true;
    trackCompareStart({ codes, source: from });
  }, [searchParams, codes]);

  // 取得済みフルデータ（code → Municipality）。一度取得したものは保持する。
  const [detail, setDetail] = useState<Record<string, DetailState>>({});
  useEffect(() => {
    for (const code of codes) {
      if (detail[code]) continue;
      setDetail((d) => ({ ...d, [code]: "loading" }));
      fetch(`/api/muni/${code}`)
        .then((r) => (r.ok ? (r.json() as Promise<Municipality>) : Promise.reject(new Error(String(r.status)))))
        .then((m) => setDetail((d) => ({ ...d, [code]: m })))
        .catch(() => setDetail((d) => ({ ...d, [code]: "error" })));
    }
  }, [codes, detail]);

  const setCodes = useCallback(
    (next: string[]) => {
      router.replace(next.length ? `/compare?codes=${next.join(",")}` : "/compare", { scroll: false });
    },
    [router],
  );
  const addCode = useCallback(
    (code: string) => {
      if (codes.includes(code) || codes.length >= MAX_COMPARE) return;
      setCodes([...codes, code]);
    },
    [codes, setCodes],
  );
  const removeCode = useCallback(
    (code: string) => setCodes(codes.filter((c) => c !== code)),
    [codes, setCodes],
  );

  // ---- ピッカー（コンボボックス。状態機械は useMuniCombobox を共有） ----
  const pickable = useMemo(
    () => (codes.length >= MAX_COMPARE ? [] : munis.filter((m) => !codes.includes(m.code))),
    [munis, codes],
  );
  const onPick = useCallback((m: MuniSummary) => addCode(m.code), [addCode]);
  const { query, setQuery, filtered, activeIndex, setActiveIndex, pick, onKeyDown } = useMuniCombobox(pickable, onPick);

  const selected = codes.map((code) => ({ code, summary: byCode.get(code), state: detail[code] }));

  // ---- 平均列の切替（全国平均／県平均） ----
  // 県平均は選択自治体がすべて同一県のときだけ意味を持つ（県をまたぐ比較では全国平均のみ）。
  const [avgKind, setAvgKind] = useState<AvgKind>("national");
  const commonPref = useMemo(() => {
    const prefs = new Set(selected.map((s) => s.summary?.pref).filter(Boolean));
    return prefs.size === 1 ? [...prefs][0]! : null;
  }, [selected]);
  const prefAvgAvailable = commonPref != null && prefAverages[commonPref] != null;
  const effectiveAvgKind: AvgKind = prefAvgAvailable && avgKind === "pref" ? "pref" : "national";
  const averages = effectiveAvgKind === "pref" ? prefAverages[commonPref!] : nationalAverages;
  const avgLabel =
    effectiveAvgKind === "pref"
      ? `${getPrefBySlug(commonPref!)?.nameJa ?? ""}平均（参考）`
      : "全国平均（参考）";

  return (
    <div className="cmp-client">
      <div className="cmp-picker">
        <div className="cmp-search" role="presentation">
          <input
            type="search"
            placeholder={codes.length >= MAX_COMPARE ? `比較は最大${MAX_COMPARE}件です` : "市区町村名を入力して追加"}
            value={query}
            disabled={codes.length >= MAX_COMPARE}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="比較する自治体を検索して追加"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls="cmp-search-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 && filtered[activeIndex] ? `copt-${filtered[activeIndex].code}` : undefined
            }
          />
          {filtered.length > 0 && (
            <ul id="cmp-search-listbox" className="search-results" role="listbox" aria-label="自治体の検索候補">
              {filtered.map((m, i) => (
                <li key={m.code} role="presentation">
                  <button
                    id={`copt-${m.code}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    tabIndex={-1}
                    className={i === activeIndex ? "is-active" : undefined}
                    onClick={() => pick(m)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="search-place">
                      {muniContextLabel(m) && <span className="search-pref">{muniContextLabel(m)}</span>}
                      <span className="search-name">{m.displayName ?? m.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {codes.length > 0 && (
          <ul className="cmp-chips" aria-label="比較中の自治体">
            {selected.map(({ code, summary }) => (
              <li key={code} className="cmp-chip">
                <span>{summary?.displayName ?? summary?.name ?? code}</span>
                <button
                  type="button"
                  className="cmp-chip-remove"
                  aria-label={`${summary?.displayName ?? summary?.name ?? code}を比較から外す`}
                  onClick={() => removeCode(code)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {codes.length === 0 ? (
        <p className="cmp-empty">
          比較したい市区町村を検索して追加してください（最大{MAX_COMPARE}件）。
        </p>
      ) : (
        <>
          {prefAvgAvailable && (
            <div className="cmp-avg-toggle" role="group" aria-label="平均の比較基準">
              <button
                type="button"
                className={`filter-seg ${effectiveAvgKind === "national" ? "is-active" : ""}`}
                aria-pressed={effectiveAvgKind === "national"}
                onClick={() => setAvgKind("national")}
              >
                全国平均
              </button>
              <button
                type="button"
                className={`filter-seg ${effectiveAvgKind === "pref" ? "is-active" : ""}`}
                aria-pressed={effectiveAvgKind === "pref"}
                onClick={() => setAvgKind("pref")}
              >
                {getPrefBySlug(commonPref!)?.nameJa ?? ""}平均
              </button>
            </div>
          )}

          {/* PC: 指標×自治体のテーブル（SPではCSSで非表示） */}
          <div className="cmp-scroll">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col" className="cmp-rowlabel">
                    指標
                  </th>
                  {selected.map(({ code, summary }) => (
                    <th scope="col" key={code}>
                      {summary ? (
                        <Link href={`/area/${summary.pref}/${summary.code}`}>{summary.displayName ?? summary.name}</Link>
                      ) : (
                        code
                      )}
                    </th>
                  ))}
                  <th scope="col" className="cmp-avg-col">{avgLabel}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_GROUPS.map((group) => (
                  <GroupRows key={group} group={group} selected={selected} averages={averages} />
                ))}
              </tbody>
            </table>
          </div>

          {/* SP: 指標単位の縦型リスト（PCではCSSで非表示）。「何を比較しているか」を
              常に見失わないよう、指標名 → 自治体ごとの値・バー → 平均 の順で縦に流す */}
          <div className="cmp-mrows">
            {COMPARE_GROUPS.map((group) => (
              <MobileGroupRows key={group} group={group} selected={selected} averages={averages} avgLabel={avgLabel} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** loading/error を除いた解決済み Municipality の配列（selected とインデックス揃い） */
function resolveSelected(selected: Array<{ code: string; state: DetailState | undefined }>) {
  return selected.map(({ state }) => (state && state !== "loading" && state !== "error" ? state : null));
}

function GroupRows({
  group,
  selected,
  averages,
}: {
  group: (typeof COMPARE_GROUPS)[number];
  selected: Array<{ code: string; state: DetailState | undefined }>;
  averages: NationalAverages;
}) {
  const rows = COMPARE_ROWS.filter((r) => r.group === group);
  const resolved = resolveSelected(selected);

  return (
    <>
      <tr className="cmp-group">
        {/* +1=指標ラベル列、+1=平均（参考）列。選択自治体列数とずれないよう常にセットで揃える */}
        <th colSpan={selected.length + 2} scope="colgroup">
          {group}
        </th>
      </tr>
      {rows.map((row) => {
        const { cells, avgValue, rowMax } = computeRow(row, resolved, averages);
        return (
          <tr key={row.key}>
            <th scope="row" className="cmp-rowlabel">
              {row.label}
            </th>
            {selected.map(({ code, state }, i) => (
              <td key={code}>
                {state === "loading" || state === undefined ? (
                  <span className="cmp-loading" aria-label="読み込み中">
                    …
                  </span>
                ) : state === "error" ? (
                  "取得エラー"
                ) : (
                  <CompareCell text={row.value(state)} value={cells[i]} max={rowMax} />
                )}
              </td>
            ))}
            <td className="cmp-avg-col">
              <CompareCell text={row.nationalAvgText?.(averages) ?? "—"} value={avgValue} max={rowMax} isAvg />
            </td>
          </tr>
        );
      })}
    </>
  );
}

/** SP用: 指標単位で自治体を縦に並べる比較ビュー（テーブルと同じ計算・同じ CompareCell を共有） */
function MobileGroupRows({
  group,
  selected,
  averages,
  avgLabel,
}: {
  group: (typeof COMPARE_GROUPS)[number];
  selected: Array<{ code: string; summary: MuniSummary | undefined; state: DetailState | undefined }>;
  averages: NationalAverages;
  avgLabel: string;
}) {
  const rows = COMPARE_ROWS.filter((r) => r.group === group);
  const resolved = resolveSelected(selected);

  return (
    <section className="cmp-mgroup">
      <h3 className="cmp-mgroup-title">{group}</h3>
      {rows.map((row) => {
        const { cells, avgValue, rowMax } = computeRow(row, resolved, averages);
        const avgText = row.nationalAvgText?.(averages);
        return (
          <div key={row.key} className="cmp-mrow">
            <p className="cmp-mrow-label">{row.label}</p>
            <ul className="cmp-mrow-list">
              {selected.map(({ code, summary, state }, i) => (
                <li key={code} className="cmp-mrow-item">
                  <span className="cmp-mrow-name">{summary?.displayName ?? summary?.name ?? code}</span>
                  <span className="cmp-mrow-value">
                    {state === "loading" || state === undefined ? (
                      <span className="cmp-loading" aria-label="読み込み中">…</span>
                    ) : state === "error" ? (
                      "取得エラー"
                    ) : (
                      <CompareCell text={row.value(state)} value={cells[i]} max={rowMax} />
                    )}
                  </span>
                </li>
              ))}
              {avgText != null && (
                <li className="cmp-mrow-item is-avg">
                  <span className="cmp-mrow-name">{avgLabel}</span>
                  <span className="cmp-mrow-value">
                    <CompareCell text={avgText} value={avgValue} max={rowMax} isAvg />
                  </span>
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

// 簡易バー＋テキスト。value が null（対象外・欠損・バー非対応の指標）ならテキストのみ。
function CompareCell({ text, value, max, isAvg }: { text: string; value: number | null; max: number; isAvg?: boolean }) {
  if (value == null) return <>{text}</>;
  const pct = barWidthPct(value, max);
  return (
    <span className="cmp-cell">
      <span className="cmp-cell-text">{text}</span>
      <span className={`cmp-bar-track ${isAvg ? "is-avg" : ""}`} aria-hidden="true">
        <span className="cmp-bar-fill" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
