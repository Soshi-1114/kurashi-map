# まちさがし（仮） machi-map

市区町村別の住みやすさ関連データ（家賃相場・地価・人口・子育て・災害リスク）を地図上で横断比較できる、一般向け無料Webサービスの**MVP雛形**です。

地図が主役で、自治体を選ぶとサイドパネル（PC）／下部シート（SP）に要約＋数値が出て、詳細SEOページへ遷移します。

> ⚠️ **これはサンプルデータで動くMVP雛形です。**
> reinfolib / e-Stat の本番APIキー取得後に、`lib/metrics.ts` 内のモック関数の中身だけを差し替えれば本番化できる設計にしています。型・モック関数のシグネチャ・データスキーマ・家賃の色しきい値は変えないでください。

## 技術スタック

- Next.js 14（App Router）
- TypeScript
- MapLibre GL JS
- デプロイ想定: Vercel

## セットアップ

```bash
npm install
npm run dev
# → http://localhost:3000
```

ビルド確認:

```bash
npm run build
```

環境変数は `.env.example` を `.env.local` にコピーして埋めてください（APIキー取得後）。`.env.local` はコミットしないでください。

## 主要構成

```
machi-map/
├ app/
│  ├ layout.tsx
│  ├ page.tsx                      # トップ＝全画面地図モード
│  └ area/[pref]/[city]/page.tsx   # 自治体詳細ページ（最小スタブ）
├ components/
│  ├ MapView.tsx                   # MapLibreラッパ（クライアントコンポーネント）
│  ├ AreaPanel.tsx                 # PCサイドパネル＋ buildSummary()
│  └ MobileSheet.tsx               # SP下部シート（3段階）
├ lib/
│  ├ types.ts                      # 【固定】Municipality 型など
│  ├ metrics.ts                    # 【固定インターフェース】モック関数群
│  └ rentColor.ts                  # 家賃→色 のユーティリティ
├ data/
│  └ saitama.json                  # 【固定スキーマ】サンプルデータ
└ public/
   └ saitama.geojson               # 行政区域ポリゴン（現状はダミー矩形）
```

## サンプルデータについて

`data/saitama.json` のサンプル値はすべて以下のフラグで本番データと区別できるようにしています:

- `isEstimated: true`
- `source: "サンプル"`

## データ差し替えTODO（APIキー取得後）

- [ ] **家賃中央値**: e-Stat（住宅・土地統計調査）→ `lib/metrics.ts` の中身
- [ ] **地価**: reinfolib（不動産情報ライブラリ）→ `lib/metrics.ts` の中身
- [ ] **ハザード**: reinfolib / 国土数値情報 → `lib/metrics.ts` の中身
- [ ] **人口・待機児童**: e-Stat / 自治体公開データ
- [ ] **要約文**: 現在は `buildSummary(m)` でテンプレ生成。LLM生成に差し替え予定
- [ ] **行政区域ポリゴン**: 現在は `public/saitama.geojson` がダミー矩形。N03（国土数値情報・行政区域データ）の埼玉県版を取得し `mapshaper N03_xxx.shp -simplify 8% -o format=geojson public/saitama.geojson` で差し替え
- [ ] **自治体コード検証**: サンプルデータの `code` は spec の値をそのまま使用。本番データ投入時に全国地方公共団体コード公式一覧で照合すること（特に 11202/11203 周辺・11215 など）
- [ ] **残り埼玉県市町村（計63）**: 現状は 10 自治体のみ。残りを同スキーマで追加（`isEstimated: true` / `source: "サンプル"`）

## 設計原則（守ること）

- 型（`lib/types.ts`）・モック関数のシグネチャ（`lib/metrics.ts`）・データスキーマ（`data/saitama.json`）・家賃の色しきい値（`lib/rentColor.ts`）は**変えない**。APIキー取得後に中身だけ差し替えられる状態を保つ。
- APIキーはサーバー側のみ。クライアントに露出させない。
- **治安・犯罪データは扱わない**（法務方針）。
- サンプル値には必ず `isEstimated: true` / `source: "サンプル"` を付け、本番データと区別できるようにする。

## 出典クレジット（予定）

- 地図タイル: 国土地理院（[https://maps.gsi.go.jp/development/ichiran.html](https://maps.gsi.go.jp/development/ichiran.html)）
- 行政区域: 国土数値情報（行政区域データ N03）
- 家賃: 総務省統計局「住宅・土地統計調査」（e-Stat 経由）
- 地価・ハザード: 国土交通省「不動産情報ライブラリ」（reinfolib）

## ライセンス

未定。本MVP雛形は内部開発用。
