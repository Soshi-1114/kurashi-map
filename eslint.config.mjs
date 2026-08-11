// ESLint flat config（eslint 9 以降の標準形式）。
// 旧 .eslintrc.json + `next lint` から移行した。背景:
//  - `next lint` は Next.js 15 で非推奨・16 で削除されるため、ESLint CLI を直接使う
//  - ESLint 10 は eslintrc 形式のサポートを削除したため flat config が必須
//  - eslint-config-next 16 が flat config（Linter.Config[]）を提供している
//    （peer は eslint>=9 のみで、Next 本体 16 へのアップグレードは要求されない）
//
// 対象は従来 `next lint` が見ていた app/ components/ lib/ に加え、
// scripts/ tests/ も含める（旧構成では未チェックだった）。
//
// TODO(依存更新時に再確認):
//  - eslint は 9 系に留めている。10 系にすると eslint-config-next 16 が
//    `TypeError: scopeManager.addGlobals is not a function` で起動しない
//    （scope manager API の破壊的変更に config 側が未追従）。package.json の
//    `^9` は 10 を防がないので、上げる前にここを確認すること。
//  - typescript も 5 系に留めている。7 系は Next 15.5 の型定義（CSS の
//    side-effect import）と @types/geojson のグローバル名前空間解決で31エラーになる。
//  - nextCoreWebVitals をリポジトリ全体に適用したうえで scripts/ を差し引く形に
//    なっている。React 用の設定を React のある場所（app/ components/ lib/）に
//    限定するほうが本筋で、config を上げるたび差し引きが増えるのを避けられる。

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    // node_modules は ESLint 9 が既定で除外するので書かない。public/ data/ reports/ も
    // lint 対象の拡張子（js/mjs/cjs/ts/tsx）を含まないため指定不要。
    ignores: [
      ".next/**",
      // Claude Code のワークツリー（リポジトリの複製が最大12個・数GB）。
      // 外さないと全体を何重にも lint することになる。skills/ は追跡下なので対象に残す。
      ".claude/worktrees/**",
    ],
  },
  ...nextCoreWebVitals,
  {
    // scripts/ は Node で動くデータ取得スクリプトで React ではない。
    // 「use」で始まる普通の関数（fetch-land-price.mjs の useField 等）が
    // React Hook と誤検出されるため外す。
    files: ["scripts/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    // eslint-config-next 16 で新たに追加された React Compiler 系のルール。
    // 既存の該当箇所は effect の組み立て直しが要るため、依存更新とは分けて対応する。
    // 対象ファイルを files で固定することで、新しいコードでは error のまま働かせる
    // （リポジトリ全体を warn に落とすと、この負債が今後も静かに増やせてしまう）。
    //
    // 注意: CI の `npm run lint` は --max-warnings を付けていないため、warning は
    // exit code に出ない。ここを解消するまでは能動的に見に行かないと気づけない。
    files: [
      "components/MapView.tsx",
      "components/MobileSheet.tsx",
      "components/compare/CompareClient.tsx",
      "lib/useMuniCombobox.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
