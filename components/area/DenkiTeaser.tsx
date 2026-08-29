// 電気代シミュレーター（/denki）への導線（自治体別）。
// 供給エリア名という自治体固有の情報を添えて内部リンクする（サーバコンポーネント）。
// 遷移の計測は /denki 側の page_view（?code= 付き）と denki_simulate で追える。
import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import { DENKI_AREA_LABELS, areaForMuni, denkiUrlForMuni } from "@/lib/denki";
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
    <AdLinkRow
      icon={<Zap size={18} aria-hidden="true" className="ad-linkrow-icon" />}
      copy={copy}
      sub={area.note ? `※${area.note}` : undefined}
      action={
        // ページ最下部の低CTR導線なので prefetch しない（1,918ページ全部で
        // /denki のチャンク+RSC 約11KB gz を先読みさせない）
        <Link href={denkiUrlForMuni(municipalityCode)} className="ad-linkrow-btn" prefetch={false}>
          電気代の目安を試算する
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      }
    />
  );
}
