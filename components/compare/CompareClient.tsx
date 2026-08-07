"use client";

// 自治体比較のインタラクティブ部分（ピッカー＋比較テーブル）。
// URL の ?codes=11203,11201 を単一の情報源とし、追加・削除は router.replace で
// URL に同期する（共有・ブックマーク可能）。フルデータは選択時に /api/muni/[code]
// から取得する（トップ地図の詳細パネルと同じ2段階配信方針）。
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Municipality, MuniSummary } from "@/lib/types";
import { COMPARE_ROWS, COMPARE_GROUPS, type NationalAverages } from "@/lib/compareMetrics";
import { useMuniCombobox } from "@/lib/useMuniCombobox";
import { muniContextLabel } from "@/lib/muniLabel";

export const MAX_COMPARE = 3;

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

export default function CompareClient({ munis, nationalAverages }: { munis: MuniSummary[]; nationalAverages: NationalAverages }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const byCode = useMemo(() => new Map(munis.map((m) => [m.code, m])), [munis]);
  const known = useMemo(() => new Set(munis.map((m) => m.code)), [munis]);
  const codes = useMemo(() => parseCodes(searchParams.get("codes"), known), [searchParams, known]);

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
                <th scope="col" className="cmp-avg-col">全国平均（参考）</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_GROUPS.map((group) => (
                <GroupRows key={group} group={group} selected={selected} nationalAverages={nationalAverages} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupRows({
  group,
  selected,
  nationalAverages,
}: {
  group: (typeof COMPARE_GROUPS)[number];
  selected: Array<{ code: string; state: DetailState | undefined }>;
  nationalAverages: NationalAverages;
}) {
  const rows = COMPARE_ROWS.filter((r) => r.group === group);
  return (
    <>
      <tr className="cmp-group">
        {/* +1=指標ラベル列、+1=全国平均（参考）列。選択自治体列数とずれないよう常にセットで揃える */}
        <th colSpan={selected.length + 2} scope="colgroup">
          {group}
        </th>
      </tr>
      {rows.map((row) => {
        // 簡易バー用の行内最大値（読み込み済みの自治体＋全国平均の中から算出）。
        // numericValue を持たない行（人口増減率・災害リスク等）はバーなしのまま。
        const rowValues = row.numericValue
          ? selected
              .map(({ state }) => (state && state !== "loading" && state !== "error" ? row.numericValue!(state) : null))
              .filter((v): v is number => v != null)
          : [];
        const avgValue = row.nationalAvgValue?.(nationalAverages) ?? null;
        const rowMax = row.numericValue ? Math.max(...rowValues, avgValue ?? 0, 1) : 1;

        return (
          <tr key={row.key}>
            <th scope="row" className="cmp-rowlabel">
              {row.label}
            </th>
            {selected.map(({ code, state }) => {
              const resolved = state && state !== "loading" && state !== "error" ? state : null;
              const numeric = resolved && row.numericValue ? row.numericValue(resolved) : null;
              return (
                <td key={code}>
                  {state === "loading" || state === undefined ? (
                    <span className="cmp-loading" aria-label="読み込み中">
                      …
                    </span>
                  ) : state === "error" ? (
                    "取得エラー"
                  ) : (
                    <CompareCell text={row.value(state)} value={numeric} max={rowMax} />
                  )}
                </td>
              );
            })}
            <td className="cmp-avg-col">
              <CompareCell text={row.nationalAvgText?.(nationalAverages) ?? "—"} value={avgValue} max={rowMax} tone="avg" />
            </td>
          </tr>
        );
      })}
    </>
  );
}

// 簡易バー＋テキスト。value が null（対象外・欠損・バー非対応の指標）ならテキストのみ。
function CompareCell({ text, value, max, tone }: { text: string; value: number | null; max: number; tone?: "avg" }) {
  if (value == null) return <>{text}</>;
  const pct = Math.max(4, (value / max) * 100);
  return (
    <span className="cmp-cell">
      <span className="cmp-cell-text">{text}</span>
      <span className={`cmp-bar-track ${tone === "avg" ? "is-avg" : ""}`} aria-hidden="true">
        <span className="cmp-bar-fill" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
