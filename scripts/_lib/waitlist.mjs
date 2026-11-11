// CFAは政令市単位で公表。市計が正数なら区の内訳を推定しない。
export function wardWaitlist(parent, asOf) {
  const value = parent.waitlistChildren.value;
  if (!Number.isInteger(value) || value < 0) throw new Error("待機児童の市計が不正です");
  return {
    value: 0, unit: "人",
    source: value === 0 ? "こども家庭庁 保育所等関連状況取りまとめ（市総合より）" :
      `区別非公表（${parent.name}全体で ${value}人）`,
    asOf, isEstimated: false,
  };
}
