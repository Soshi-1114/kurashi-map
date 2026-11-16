// 例: node --env-file=.env.local --import tsx scripts/feedback/report.ts --page ranking:stations --section ranking
import { FEEDBACK_VERSION } from "../../lib/contentFeedback";
import { feedbackConfig, feedbackReport, validFeedbackTarget } from "../../lib/contentFeedbackServer";

async function main() {
  const value = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];
  const config = feedbackConfig();
  const target = await validFeedbackTarget({ page: value("--page"), section: value("--section"), version: FEEDBACK_VERSION });
  if (!config || !target) throw new Error("有効な保存先と --page / --section が必要です");
  const result = await feedbackReport(config, target);
  console.log(JSON.stringify({ ...target, counts: result }, null, 2));
}

main().catch(() => {
  console.error("アンケート集計を取得できませんでした。対象と保存先設定を確認してください（認証情報は非表示）。");
  process.exitCode = 1;
});
