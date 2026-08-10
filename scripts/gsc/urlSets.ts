// 施策対象URLセットの追跡。「このPRで触ったURL群は、投入前後でどう変わったか」を
// レポートに出すための仕組み。
//
// セットの定義は docs/seo/url-sets.json に置く（reports/ は .gitignore 済みで
// 新規クローンに存在しないため、施策と同じPRでコミットできる場所に置く）。
// PR #126 は約658URL、PR #129 は全1,918URLに及ぶので、URL の直書きではなく
// グロブパターンで表現する。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL_SETS_PATH } from "./config";
import { escapeRegExp } from "./queryMeta";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

export interface UrlSet {
  /** 識別子（レポートの見出しに出る） */
  name: string;
  /** 関連PR番号（任意） */
  pr?: number;
  /** 本番反映日 YYYY-MM-DD。--since の指定値を決める目安として出す（任意） */
  since?: string;
  /** 何をした施策か（レポートに併記する短い説明） */
  note?: string;
  /** 対象にするパスのグロブ。`*`=1セグメント、`**`=以降すべて */
  include: string[];
  /** include から除外するパスのグロブ（任意） */
  exclude?: string[];
}

/**
 * グロブ → 正規表現。`*` は「/ を含まない1セグメント」、`**` は「以降すべて」。
 * 例: "/ranking/*\/*" は /ranking/rent-cheap/saitama に一致し /ranking/rent-cheap には一致しない。
 */
export function globToRegExp(glob: string): RegExp {
  // ワイルドカードで分割し、それ以外の区間はまとめてエスケープする（queryMeta と共有）。
  const body = glob
    .split(/(\*\*|\*)/)
    .map((part) => (part === "**" ? ".*" : part === "*" ? "[^/]*" : escapeRegExp(part)))
    .join("");
  return new RegExp(`^${body}$`);
}

export interface CompiledUrlSet extends UrlSet {
  matches: (path: string) => boolean;
}

export function compileUrlSet(set: UrlSet): CompiledUrlSet {
  const include = set.include.map(globToRegExp);
  const exclude = (set.exclude ?? []).map(globToRegExp);
  return {
    ...set,
    matches: (p: string) => include.some((re) => re.test(p)) && !exclude.some((re) => re.test(p)),
  };
}

/** パターンの正規化キー（同一URL群のセットを検出するため。順序差は無視する）。 */
function patternKey(set: UrlSet): string {
  return JSON.stringify([[...set.include].sort(), [...(set.exclude ?? [])].sort()]);
}

function assertValid(sets: unknown): UrlSet[] {
  if (!Array.isArray(sets)) throw new Error(`${URL_SETS_PATH} は配列である必要があります。`);
  const validated = sets.map((s, i) => {
    const set = s as Partial<UrlSet>;
    if (!set.name || !Array.isArray(set.include) || set.include.length === 0) {
      throw new Error(`${URL_SETS_PATH}[${i}] には name と1件以上の include が必要です。`);
    }
    return set as UrlSet;
  });

  // 同じURL群を指すセットが2つあると、レポートに必ず同じ数字の行が並び「別々に効果を
  // 測れている」と誤読させる。同日に同じページへ入れた施策は1セットにまとめること。
  const seen = new Map<string, string>();
  for (const set of validated) {
    const key = patternKey(set);
    const dup = seen.get(key);
    if (dup) {
      throw new Error(
        `${URL_SETS_PATH}: "${dup}" と "${set.name}" が同一のURL群を指しています。` +
          `効果を分離できないため1セットにまとめ、note に両方の施策を書いてください。`,
      );
    }
    seen.set(key, set.name);
  }
  return validated;
}

/** docs/seo/url-sets.json を読み込む。ファイルが無ければ空配列（機能は任意）。 */
export function loadUrlSets(): CompiledUrlSet[] {
  const fp = path.join(ROOT, URL_SETS_PATH);
  if (!fs.existsSync(fp)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch (e) {
    throw new Error(`${URL_SETS_PATH} の JSON 解析に失敗しました: ${String(e)}`);
  }
  return assertValid(parsed).map(compileUrlSet);
}
