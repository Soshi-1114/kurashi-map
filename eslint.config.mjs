// ESLint flat config（eslint 9 以降の標準形式）。
// 旧 .eslintrc.json + `next lint` から移行した。背景:
//  - `next lint` は Next.js 15 で非推奨・16 で削除されるため、ESLint CLI を直接使う
//  - ESLint 10 は eslintrc 形式のサポートを削除したため flat config が必須
//  - eslint-config-next 16 が flat config（Linter.Config[]）を提供している
//    （peer は eslint>=9 のみで、Next 本体 16 へのアップグレードは要求されない）
//
// 対象は従来 `next lint` が見ていた app/ components/ lib/ に加え、
// scripts/ tests/ も含める（旧構成では未チェックだった）。

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    // .claude/ は Claude Code のワークツリー（リポジトリの複製）なので対象外。
    // ここを含めるとリポジトリ全体を二重に lint してしまう。
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "public/**",
      "reports/**",
      "data/**",
      ".claude/**",
    ],
  },
  ...nextCoreWebVitals,
  {
    // scripts/ は Node で動くデータ取得スクリプトで React ではない。
    // 「use」で始まる普通の関数（useField 等）が React Hook と誤検出されるため外す。
    files: ["scripts/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    // eslint-config-next 16 で新たに追加された React Compiler 系のルール群。
    // 既存コードに6件該当するが、いずれも effect の組み立て直しが要るため
    // 依存更新とは分けて対応する。握りつぶさず warn として見える状態を保つ。
    // 該当: components/MapView.tsx, components/MobileSheet.tsx,
    //       components/compare/CompareClient.tsx, lib/useMuniCombobox.ts
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
