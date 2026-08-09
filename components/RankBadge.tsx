// 順位バッジ（メダル・ラダー番号・県別順位）を1箇所に集約。membershipList 型の
// ランキング（例: 待機児童ゼロ）は「順位」ではなく該当マーク（✓）だけを見せる。
// 呼び出し側は className と、順位表示時の内容・aria-label だけを渡す。
type RankBadgeProps = {
  className: string;
  isList: boolean | undefined;
  /** 通常時（順位）に表示する内容。 */
  rank: React.ReactNode;
  /** 通常時の aria-label（省略時は可視テキストのみ）。 */
  rankAriaLabel?: string;
  /** 該当マーク（✓）の aria-label（省略時は装飾として aria-hidden）。 */
  checkAriaLabel?: string;
};

export function RankBadge({ className, isList, rank, rankAriaLabel, checkAriaLabel }: RankBadgeProps) {
  if (isList) {
    return checkAriaLabel ? (
      <span className={className} aria-label={checkAriaLabel}>✓</span>
    ) : (
      <span className={className} aria-hidden="true">✓</span>
    );
  }
  return rankAriaLabel ? (
    <span className={className} aria-label={rankAriaLabel}>{rank}</span>
  ) : (
    <span className={className}>{rank}</span>
  );
}
