// scripts/_lib/prefs.mjs の県別 bbox から components/map/prefBboxes.ts を生成する。
// 地図ディープリンク（/?pref=）と県クリック fly-in の初期ビューに使う。
// prefectures.geojson のジオメトリ bbox は島嶼を含む（東京→小笠原、鹿児島→奄美まで
// 入って引きすぎる）ため、reinfolib 取得用に手入れ済みの prefs.mjs の値を単一ソースにする。
//
// 使い方: node scripts/build-pref-bboxes.mjs
// prefs.mjs の bbox を変更したら再実行してコミットする（tests/lib/prefBboxes.test.ts が
// 生成物と prefs.mjs のドリフトを検出する）。
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PREFS } from "./_lib/prefs.mjs";

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "components",
  "map",
  "prefBboxes.ts",
);

const lines = Object.entries(PREFS).map(([slug, p]) => {
  const { west, south, east, north } = p.bbox;
  return `  ${slug}: [${west}, ${south}, ${east}, ${north}],`;
});

const src = `// 自動生成ファイル。直接編集せず \`node scripts/build-pref-bboxes.mjs\` で再生成する。
// ソースは scripts/_lib/prefs.mjs の県別 bbox（[west, south, east, north]）。
// 島嶼を除いた本土中心のビューポート判断（東京=本土＋多摩のみ等）は prefs.mjs 側の
// コメントを参照。データの推計ではなく初期表示範囲の選定なので honesty 方針に抵触しない。
export const PREF_BBOXES: Record<string, [number, number, number, number]> = {
${lines.join("\n")}
};
`;

writeFileSync(outPath, src);
console.log(`generated ${outPath} (${Object.keys(PREFS).length} prefs)`);
