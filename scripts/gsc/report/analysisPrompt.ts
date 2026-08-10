// analysis-prompt.md 生成。ほぼ静的なテンプレートに期間などの動的情報を差し込む。
// 添付する analysis.json を ChatGPT / Claude に読ませ、SEO 改善方針を提案させる目的のプロンプト。

import type { ReportBundle } from "./types";

export function buildAnalysisPrompt(b: ReportBundle): string {
  return `# KurashiMap SEO分析プロンプト

添付されている \`analysis.json\`（対象期間: ${b.current.startDate} 〜 ${b.current.endDate}、property: \`${b.siteUrl}\`）は、
Google Search Console のデータを KurashiMap のページ・自治体マスタと突き合わせて集計した SEO 分析データセットです。

KurashiMap は市区町村別の住みやすさ関連データ（家賃・地価・人口・子育て・災害リスク・生活インフラ）を地図で比較できる、
全47都道府県・1,918自治体の詳細ページを持つ SEO 型 Web サービスです。

この analysis.json を分析し、KurashiMap の SEO 改善方針を提案してください。以下の観点を必ず含めてください。

1. サイト全体の SEO 成長（\`site\` の推移・期間比較）
2. Google による自治体ページの認識状況（\`municipalities.coverage\` の露出率・未露出件数）
3. インプレッション増加傾向（\`site.daily\` / \`newVisibilityPages\`）
4. CTR 改善余地（\`opportunities.highImpressionLowCtr\`）
5. 11〜20位ページの改善余地（\`opportunities.page2\`。特に11〜15位を優先）
6. 検索クエリとページ内容の一致度（\`queryCategories\` とページ種別の対応）
7. 自治体ページ間の SEO 格差（\`municipalities.byStatus\` / \`municipalities.top\`）
8. 都道府県別の傾向（\`prefectures\` の露出率・clicks のばらつき）
9. コンテンツ改善候補（\`opportunities.nearTop\` など、僅かな改善で上位表示が狙えるページ）
10. title / description 改善候補（低CTRページの検索意図とタイトルの一致度）
11. 内部リンク改善候補（未露出・弱い自治体ページへの導線強化）
12. 新規コンテンツ候補（\`queryCategories\` の \`other\` に埋もれている未対応テーマ）

出力は「優先度付きの具体的なアクションリスト」として、対象ページ／クエリ／期待効果をセットで示してください。
判断の根拠となった analysis.json 内の数値（clicks / impressions / ctr / position）を引用しながら説明してください。

## データの制約（分析時に考慮してください）

${b.dataNotes.map((n) => `- ${n}`).join("\n")}
- GSC Search Analytics API は上位データ中心の抽出・匿名化のため、低頻度のクエリ・行を完全に保証して取得できているわけではありません。
`;
}
