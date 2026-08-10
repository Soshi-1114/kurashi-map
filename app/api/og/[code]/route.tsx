import { ImageResponse } from "next/og";
import { getMunicipality } from "@/lib/metrics";
import { prefNameOf } from "@/lib/site";
import { hasRent } from "@/lib/rentColor";
import { hasLandPrice } from "@/lib/landPrice";
import { OG_RESPONSE, OgFrame, OgHeading, Stat } from "@/lib/og";

// getMunicipality はテンプレートリテラル動的 import で全県の data/*.json をバンドルするため、
// edge だと Edge Function サイズ上限(4.02MB)を超える。Node ランタイムなら制限が桁違いに大きく、
// next/og(ImageResponse) も Node で動作する。OG 画像は Cache-Control で長期キャッシュ済み。
export const runtime = "nodejs";

export async function GET(_req: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  // 全国地方公共団体コードは5桁数字。形式不正はデータ探索に入る前に弾く。
  if (!/^\d{5}$/.test(params.code)) {
    return new Response("invalid code", { status: 400 });
  }
  const m = await getMunicipality(params.code);
  if (!m) {
    return new Response("not found", { status: 404 });
  }
  const prefName = prefNameOf(m.pref);
  // 区の場合はパンくず的に "埼玉県 / さいたま市" を上に出し、見出しは "浦和区" のみ
  const parent = m.parentCode ? await getMunicipality(m.parentCode) : null;
  const breadcrumbText = parent ? `${prefName} / ${parent.name}` : prefName;
  const rentHasData = hasRent(m.rent.value);
  const rent = m.rent.value.toLocaleString();
  const pop = m.population.toLocaleString();
  // ImageResponse の組込フォントには U+33A1 (㎡) のグリフが無いため m² に置換
  const landUnit = (m.landPrice.unit || "").replace("㎡", "m²");
  const land = hasLandPrice(m.landPrice.value)
    ? `${m.landPrice.value.toLocaleString()}${landUnit ? ` ${landUnit}` : ""}`
    : "データなし";

  return new ImageResponse(
    (
      <OgFrame>
        <OgHeading eyebrow={breadcrumbText} title={m.name} sub="の住みやすさ" titleSize={96} />

        <div style={{ marginTop: "auto", display: "flex", gap: 24 }}>
          {rentHasData ? (
            <Stat label="家賃中央値" value={`${rent}円/月`} accent />
          ) : (
            <Stat label="人口増減" value={m.populationTrend} accent />
          )}
          <Stat label="人口" value={`${pop}人`} />
          <Stat label="地価" value={land} />
        </div>
      </OgFrame>
    ),
    OG_RESPONSE,
  );
}
