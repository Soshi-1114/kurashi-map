// 電気代シミュレーター（/denki）への導線（自治体別）。
// 供給エリア名という自治体固有の情報を添えて内部リンクする（サーバコンポーネント）。
// 視認・クリックと /denki 側の tool_entry（from=area_detail）を対で確認できる。
import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import { DENKI_AREA_LABELS, areaForMuni } from "@/lib/denki";
import { denkiHref } from "@/lib/siteNav";
import DenkiEntryTracking from "@/components/denki/DenkiEntryTracking";
import { AdLinkRow } from "@/components/monetization/AdLinkRow";

export function DenkiTeaser({
  municipalityCode,
  municipalityName,
}: {
  municipalityCode: string;
  municipalityName: string;
}) {
  const area = areaForMuni(municipalityCode);
  if (!area) return null;
  // 供給エリアが地区で分かれる自治体では断定しない（honesty 方針）
  const copy = area.altArea
    ? `${municipalityName}は地区によって${DENKI_AREA_LABELS[area.area]}と${DENKI_AREA_LABELS[area.altArea]}に分かれます。`
    : `${municipalityName}は${DENKI_AREA_LABELS[area.area]}です。`;
  return (
    <DenkiEntryTracking key={municipalityCode} municipalityCode={municipalityCode} area={area.area}>
      <AdLinkRow
        icon={<Zap size={18} aria-hidden="true" className="ad-linkrow-icon" />}
        copy={`${municipalityName}の電気代の目安を確認する`}
        sub={`世帯人数や使用量から月額を試算できます。${copy}${area.note ? `（${area.note}）` : ""}`}
        action={
          // 利用する人だけ読み込むよう prefetch しない（1,918ページ全部で
          // /denki のチャンク+RSC 約11KB gz を先読みさせない）
          <Link href={denkiHref(municipalityCode, "area_detail")} data-denki-entry className="ad-linkrow-btn" prefetch={false}>
            電気代の目安を試算する
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        }
      />
    </DenkiEntryTracking>
  );
}
