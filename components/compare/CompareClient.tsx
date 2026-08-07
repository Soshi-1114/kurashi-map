"use client";

// 自治体比較のインタラクティブ部分（ピッカー＋比較テーブル）。
// URL の ?codes=11203,11201 を単一の情報源とし、追加・削除は router.replace で
// URL に同期する（共有・ブックマーク可能）。フルデータは選択時に /api/muni/[code]
// から取得する（トップ地図の詳細パネルと同じ2段階配信方針）。
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Municipality, MuniSummary } from "@/lib/types";
import { COMPARE_ROWS, COMPARE_GROUPS } from "@/lib/compareMetrics";
import { getPrefByCode } from "@/lib/prefs";

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

export default function CompareClient({ munis }: { munis: MuniSummary[] }) {
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

  // ---- ピッカー（コンボボックス） ----
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q || codes.length >= MAX_COMPARE) return [];
    return munis
      .filter((m) => !codes.includes(m.code) && ((m.displayName ?? m.name).includes(q) || m.name.includes(q)))
      .slice(0, 8);
  }, [query, munis, codes]);
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const pick = useCallback(
    (m: MuniSummary) => {
      setQuery("");
      addCode(m.code);
    },
    [addCode],
  );
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setQuery("");
        return;
      }
      if (!filtered.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          e.preventDefault();
          pick(filtered[activeIndex]);
        }
      }
    },
    [filtered, activeIndex, pick],
  );

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
                      <span className="search-pref">{getPrefByCode(m.code)?.nameJa ?? ""}</span>
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
              </tr>
            </thead>
            <tbody>
              {COMPARE_GROUPS.map((group) => (
                <GroupRows key={group} group={group} selected={selected} />
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
}: {
  group: (typeof COMPARE_GROUPS)[number];
  selected: Array<{ code: string; state: DetailState | undefined }>;
}) {
  const rows = COMPARE_ROWS.filter((r) => r.group === group);
  return (
    <>
      <tr className="cmp-group">
        <th colSpan={selected.length + 1} scope="colgroup">
          {group}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={row.key}>
          <th scope="row" className="cmp-rowlabel">
            {row.label}
          </th>
          {selected.map(({ code, state }) => (
            <td key={code}>
              {state === "loading" || state === undefined ? (
                <span className="cmp-loading" aria-label="読み込み中">
                  …
                </span>
              ) : state === "error" ? (
                "取得エラー"
              ) : (
                row.value(state)
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
