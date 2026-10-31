import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import StockpileClient from "@/components/bousai/StockpileClient";
import { STOCKPILE_SOURCES } from "@/lib/stockpile";
import { SITE, absoluteUrl } from "@/lib/site";
import "./stockpile.css";
const title = `家庭の備蓄チェック｜人数別の水の目安・買い足しリスト - ${SITE.name}`;
const description = "家族の人数と3日・7日分の備蓄日数から、水の必要量と不足量を確認。食品・日用品の手持ちを整理し、買い足し・確認リストを印刷・コピーできます。登録不要。";
export const metadata: Metadata = { title, description, alternates: { canonical: "/bousai/stockpile" }, openGraph: { title, description, url: absoluteUrl("/bousai/stockpile"), type: "website" } };
export default function StockpilePage() {
  return <PageShell width="narrow" innerClassName="stock-root" trail={[{ name: "ホーム", href: "/" }, { name: "家庭の備蓄チェック" }]}>
    <header className="stock-intro"><h1>家庭の備蓄チェック</h1><p>人数に合う水の目安を知り、食品・日用品の買い足しリストを作れます。</p></header>
    <noscript><p>計算と保存にはJavaScriptが必要です。下の公的な備蓄ガイドでも準備する物を確認できます。</p></noscript>
    <StockpileClient />
    <aside className="stock-scope"><strong>自宅周辺のハザードと避難先も確認</strong><p>このチェックは避難時の持ち出し品リストではありません。地域の想定区域や避難先は自治体の情報で確認してください。</p><Link href="/map/hazard">地域のハザードを確認する</Link></aside>
    <section className="stock-sources"><h2>目安の根拠・備蓄ガイド</h2><p>水は飲料・調理用として1人1日3Lを使用。食品・日用品の量や種類は家庭に合わせて確認してください。乳幼児や食事への配慮が必要な方の備えは、食品ストックガイドも参考になります。</p><ul>{STOCKPILE_SOURCES.map(s => <li key={s.url}><a href={s.url}>{s.label}</a></li>)}</ul><p>出典確認日：2026年10月24日。本チェックの項目は編集上の整理であり、公的機関による家庭ごとの診断ではありません。</p></section>
  </PageShell>;
}
