// 指定 statsDataId のメタデータを取得して軸構造を表示。
// 実行: node --env-file=.env.local scripts/estat-meta.mjs <statsDataId>

const APP_ID = process.env.ESTAT_APP_ID;
if (!APP_ID) {
  console.error("ESTAT_APP_ID が未設定");
  process.exit(1);
}
const id = process.argv[2] || "0003445078";

const url = new URL("https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo");
url.searchParams.set("appId", APP_ID);
url.searchParams.set("statsDataId", id);

const res = await fetch(url);
const data = await res.json();
const meta = data.GET_META_INFO?.METADATA_INF;
if (!meta) {
  console.error("metadata not found");
  console.log(JSON.stringify(data, null, 2).slice(0, 2000));
  process.exit(1);
}

const title = meta.TABLE_INF?.TITLE?.$ ?? meta.TABLE_INF?.TITLE;
console.log("Table:", title);
console.log("---");

const classObj = meta.CLASS_INF?.CLASS_OBJ ?? [];
const classes = Array.isArray(classObj) ? classObj : [classObj];
for (const c of classes) {
  const cid = c["@id"];
  const cname = c["@name"];
  const items = c.CLASS ? (Array.isArray(c.CLASS) ? c.CLASS : [c.CLASS]) : [];
  console.log(`\n軸 ${cid}: ${cname} (${items.length} items)`);
  for (const it of items.slice(0, 20)) {
    console.log(`  ${it["@code"]}: ${it["@name"]}`);
  }
  if (items.length > 20) console.log(`  ... +${items.length - 20} more`);
}
