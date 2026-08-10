// 集計期間と比較期間の決定。CLI から独立した純粋関数にして
// tests/scripts/gsc/periods.test.ts でユニットテストする。
//
// 施策の効果検証（例: PR #129 を 2026-08-20 にデプロイした → その前後28日を比べる）を
// レポートディレクトリの差分ではなく「GSC API から任意期間を取り直す」方式で行う。
// reports/gsc/ は .gitignore 済みで新規クローンや CI には存在せず、ディレクトリ名も
// データ期間ではなく実行日なので基準にできないため。GSC は約16か月ぶん保持しているので
// 過去の任意期間はいつでも再構成でき、両期間が同じ分類・集計コードを通ることも保証される。

import type { PeriodRange } from "./types";

export type CompareMode = "none" | "adjacent" | "yoy" | "baseline" | "since";

export interface PeriodPlan {
  current: PeriodRange;
  previous: PeriodRange | null;
  /** 期間の切り詰めなど、レポートに残すべき注意書き（無ければ undefined） */
  warning?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return toISODate(d);
}

/** 2つの日付の差（日数）。b - a。 */
function diffDays(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

function assertISO(value: string, flag: string): string {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${flag} は YYYY-MM-DD 形式で指定してください。受け取った値: "${value}"`);
  }
  return value;
}

/** "YYYY-MM-DD..YYYY-MM-DD" を解析する。 */
export function parseRangeArg(value: string, flag: string): { startDate: string; endDate: string } {
  const parts = value.split("..");
  if (parts.length !== 2) {
    throw new Error(`${flag} は "YYYY-MM-DD..YYYY-MM-DD" 形式で指定してください。受け取った値: "${value}"`);
  }
  const startDate = assertISO(parts[0].trim(), flag);
  const endDate = assertISO(parts[1].trim(), flag);
  if (diffDays(startDate, endDate) < 0) {
    throw new Error(`${flag} の開始日が終了日より後です: "${value}"`);
  }
  return { startDate, endDate };
}

export interface ResolveOptions {
  days: number;
  /** 実行日（YYYY-MM-DD） */
  today: string;
  /** GSC のデータ確定ラグ（日）。today からこの日数を引いた日を集計終端にする。 */
  lagDays: number;
  compareMode: CompareMode;
  /** compareMode="baseline" のときの比較期間 "YYYY-MM-DD..YYYY-MM-DD" */
  baseline?: string;
  /** compareMode="since" のときの起点日（デプロイ日）。この前後 days 日を比べる。 */
  since?: string;
}

/** 集計期間・比較期間を決める。 */
export function resolvePeriods(opts: ResolveOptions): PeriodPlan {
  const { days, today, lagDays, compareMode } = opts;
  const dataEnd = addDays(today, -lagDays);

  if (compareMode === "since") {
    if (!opts.since) throw new Error("--since には起点日（YYYY-MM-DD）が必要です。");
    const since = assertISO(opts.since, "--since");
    // 起点日当日を「後」の初日とし、その直前 days 日を「前」にする。
    const wantedEnd = addDays(since, days - 1);
    const currentEnd = diffDays(wantedEnd, dataEnd) < 0 ? dataEnd : wantedEnd;
    const available = diffDays(since, currentEnd) + 1;
    if (available <= 0) {
      throw new Error(
        `--since=${since} は GSC のデータ確定終端（${dataEnd}）より後です。効果を測るにはまだ早すぎます。`,
      );
    }
    return {
      current: { startDate: since, endDate: currentEnd, label: `${since}以降${available}日` },
      previous: {
        startDate: addDays(since, -days),
        endDate: addDays(since, -1),
        label: `${since}より前の${days}日`,
      },
      warning:
        available < days
          ? `--since の「後」期間は ${days} 日を指定されましたが、GSC のデータ確定終端（${dataEnd}）までの ${available} 日ぶんしかありません。前後の日数が揃っていないため増減の比較は参考値です。`
          : undefined,
    };
  }

  const endDate = dataEnd;
  const startDate = addDays(endDate, -(days - 1));
  const current: PeriodRange = { startDate, endDate, label: `直近${days}日` };

  if (compareMode === "none") return { current, previous: null };

  if (compareMode === "baseline") {
    if (!opts.baseline) throw new Error("--baseline には期間（YYYY-MM-DD..YYYY-MM-DD）が必要です。");
    const range = parseRangeArg(opts.baseline, "--baseline");
    const span = diffDays(range.startDate, range.endDate) + 1;
    return {
      current,
      previous: { ...range, label: `${range.startDate}〜${range.endDate}` },
      warning:
        span !== days
          ? `--baseline の期間は ${span} 日で、集計期間の ${days} 日と長さが違います。合計値（clicks/impressions）の増減は日数差を含むため、CTR・平均掲載順位で比べてください。`
          : undefined,
    };
  }

  if (compareMode === "yoy") {
    return {
      current,
      previous: { startDate: addDays(startDate, -365), endDate: addDays(endDate, -365), label: "前年同期" },
    };
  }

  // adjacent: 直前の同じ長さの期間
  const prevEnd = addDays(startDate, -1);
  return {
    current,
    previous: { startDate: addDays(prevEnd, -(days - 1)), endDate: prevEnd, label: `前${days}日` },
  };
}
