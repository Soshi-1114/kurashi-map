import { describe, it, expect, afterEach } from "vitest";
import { VERSIONS, version } from "../../scripts/_lib/versions.mjs";

// 年度依存の出典バージョンの単一ソース（scripts/_lib/versions.mjs）。
// 年度更新でキーが欠けたり URL/ASOF の同期がずれたりする事故を検知する。
describe("VERSIONS 単一ソース", () => {
  it("annual ワークフローと各スクリプトが要求する全キーを持つ", () => {
    const required = [
      "L01_VERSION", "L01_ASOF",
      "CFA_XLSX_URL", "CFA_ASOF",
      "GSI_SHELTER_URL", "GSI_SHELTER_ASOF",
      "FOREIGN_ASOF",
      "MEDICAL_HOSP_STATSDATAID", "MEDICAL_CLINIC_STATSDATAID", "MEDICAL_ASOF",
      "S12_URL", "S12_ASOF",
      "AMENITIES_SOURCE", "AMENITIES_ASOF",
    ];
    for (const k of required) {
      expect(VERSIONS[k], `${k} が未定義`).toBeTypeOf("string");
      expect(VERSIONS[k].length, `${k} が空`).toBeGreaterThan(0);
    }
  });

  it("$GITHUB_ENV に展開できるよう、値は改行を含まない単一行", () => {
    for (const [k, v] of Object.entries(VERSIONS)) {
      expect(v.includes("\n"), `${k} が複数行`).toBe(false);
    }
  });

  it("L01_VERSION と L01_ASOF が同期している（例 26 ⇔ 2026）", () => {
    // zip 版番号 NN は令和(NN-8)年＝西暦 20NN。ASOF 末尾2桁が VERSION と一致する。
    expect(VERSIONS.L01_ASOF).toBe(`20${VERSIONS.L01_VERSION}`);
  });

  it("AMENITIES_ASOF の医療機関部分が MEDICAL_ASOF と同期している", () => {
    // 医療施設調査の年度を上げたら amenities の表示ラベルも合わせる運用（片方だけの更新を検知）。
    expect(VERSIONS.AMENITIES_ASOF).toContain(VERSIONS.MEDICAL_ASOF);
  });

  it("AMENITIES_ASOF の駅部分が S12_ASOF と同期している", () => {
    expect(VERSIONS.AMENITIES_ASOF).toContain(VERSIONS.S12_ASOF);
  });

  it("S12_URL の年度採番と S12_ASOF が同期している（S12-24 ⇔ 2024年度）", () => {
    const m = VERSIONS.S12_URL.match(/S12-(\d{2})_GML\.zip$/);
    expect(m, "URL に S12-NN 採番が見つからない").not.toBeNull();
    expect(VERSIONS.S12_ASOF).toBe(`20${m![1]}年度`);
  });

  it("CFA_XLSX_URL の年度採番と CFA_ASOF が整合する（r7 ⇔ 2025）", () => {
    // URL の _rN_ は令和N年。CFA_ASOF は西暦の年度開始日（令和N年 = 西暦 2018+N）。
    const m = VERSIONS.CFA_XLSX_URL.match(/_r(\d+)_/);
    expect(m, "URL に _rN_ 採番が見つからない").not.toBeNull();
    const reiwa = Number(m![1]);
    const asOfYear = Number(VERSIONS.CFA_ASOF.slice(0, 4));
    expect(asOfYear).toBe(2018 + reiwa);
  });
});

describe("version() ヘルパー", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it("env 未設定なら VERSIONS の既定を返す", () => {
    delete process.env.L01_VERSION;
    expect(version("L01_VERSION")).toBe(VERSIONS.L01_VERSION);
  });

  it("env が設定されていれば env を優先する（CI 上書き）", () => {
    process.env.L01_VERSION = "99";
    expect(version("L01_VERSION")).toBe("99");
  });

  it("空文字 env は既定にフォールバックする", () => {
    process.env.GSI_SHELTER_ASOF = "";
    expect(version("GSI_SHELTER_ASOF")).toBe(VERSIONS.GSI_SHELTER_ASOF);
  });
});
