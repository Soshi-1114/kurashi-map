// 電気代シミュレーター（/denki）への導線（自治体別）。
// 供給エリア名という自治体固有の情報を添えて内部リンクする（サーバコンポーネント）。
// 遷移の計測は /denki 側の page_view（?code= 付き）と denki_simulate で追える。
import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import { areaForMuni, DENKI_AREA_LABELS } from "@/lib/denki";

export function DenkiTeaser({ code, name }: { code: string; name: string }) {
  const area = areaForMuni(code);
  if (!area) return null;
  return (
    <div className="ad-denki">
      <div className="ad-denki-text">
        <Zap size={18} aria-hidden="true" className="ad-denki-icon" />
        <p className="ad-denki-copy">
          {name}は{DENKI_AREA_LABELS[area.area]}です。
          {area.altArea && <span className="ad-denki-sub">※{area.note}</span>}
        </p>
      </div>
      <Link href={`/denki?code=${code}`} className="ad-denki-btn">
        電気代の目安を試算する
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
