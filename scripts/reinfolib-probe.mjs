// reinfolib API 接続テスト＋取引タイプ確認
// 実行: node --env-file=.env.local scripts/reinfolib-probe.mjs

const KEY = process.env.REINFOLIB_API_KEY;
if (!KEY) {
  console.error("REINFOLIB_API_KEY が未設定。.env.local を確認");
  process.exit(1);
}

const BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external";

// XIT001: 不動産価格情報 (取引価格 + 成約価格)
// 引数: priceClassification (00=不動産取引価格情報, 01=成約価格情報), year, quarter, area等
async function probe() {
  // 埼玉県 (11) 2024年第4四半期 - 不動産取引価格情報
  const url = new URL(`${BASE}/XIT001`);
  url.searchParams.set("year", "2024");
  url.searchParams.set("quarter", "4");
  url.searchParams.set("area", "11"); // 都道府県=埼玉
  // priceClassification 省略で両方

  const res = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": KEY },
  });
  console.log("status:", res.status);
  console.log("content-type:", res.headers.get("content-type"));
  const body = await res.text();
  console.log("body (head):", body.slice(0, 2000));

  if (res.ok) {
    const data = JSON.parse(body);
    const arr = data.data ?? [];
    console.log("\n--- count:", arr.length, "---");
    if (arr.length > 0) {
      console.log("type field unique values:");
      const types = new Set();
      const subTypes = new Set();
      for (const r of arr) {
        if (r.Type) types.add(r.Type);
        if (r.PriceCategory) subTypes.add(r.PriceCategory);
      }
      console.log("  Types:", [...types]);
      console.log("  PriceCategories:", [...subTypes]);
      console.log("\nsample[0] keys:", Object.keys(arr[0]));
      console.log("sample[0]:", JSON.stringify(arr[0], null, 2));
    }
  }
}

probe().catch((e) => { console.error(e); process.exit(1); });
