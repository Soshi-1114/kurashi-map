/** 日本語の語中で「ランキング」が分かれないようにする。見出しの文言は維持する。 */
export default function RankingTitle({ title }: { title: string }) {
  return <h1 className="rk-title">{title.split(/(ランキング)/).map((part, index) =>
    part === "ランキング" ? <span className="rk-title-word" key={index}>{part}</span> : part,
  )}</h1>;
}
