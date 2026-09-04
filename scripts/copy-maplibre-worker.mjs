// maplibre-gl v6 の WebWorker を public/ へ複製する（postinstall で実行）。
//
// v6 から worker は blob ではなく実URLの別ファイル（ESM）としてロードされるが、
// その解決が動的（new URL(`./${name}`, ...)）なため webpack/Next はバンドルに
// 含められない。そこで dist の worker と、worker が相対 import する shared chunk を
// public/vendor/maplibre/ に複製し、MapView 側で setWorkerUrl() でこのURLを指す。
// 複製元は node_modules なので、maplibre-gl 更新時も postinstall で自動追従する
// （public/vendor/ はコミットしない。.gitignore 参照）。
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "maplibre-gl", "dist");
const dest = join(root, "public", "vendor", "maplibre");

// worker 本体と、worker が相対 import する shared chunk（両方必須）
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(src)) {
  // npm ci --omit の変則環境などで maplibre が無い場合はスキップ（build 前に必ず入る）
  console.warn("copy-maplibre-worker: maplibre-gl が見つからないためスキップ");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const f of FILES) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log(`copy-maplibre-worker: ${FILES.join(", ")} → public/vendor/maplibre/`);
