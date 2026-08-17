// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeroSearch from "@/components/home/HeroSearch";
import { MAP_FLY_EVENT, type MapFlyDetail } from "@/lib/mapFly";
import { muniSummary } from "../_fixtures";

// トップのヒーロー検索。MuniSearch と違い、確定で詳細ページへ遷移する。
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// サジェスト API のモック（town-search / station-search 共通）。useDebouncedSuggest は
// レスポンスから自分のキーだけを pluck するため、両キーを常に返す1本で足りる。
// 「日の里」クエリのみ町丁ヒット、「品川」クエリのみ駅ヒットを返す。
const fetchMock = vi.fn(async (url: string) => ({
  ok: true,
  json: async () => ({
    towns: url.includes(encodeURIComponent("日の里")) ? [{ code: "40220", town: "日の里" }] : [],
    stations: url.includes(encodeURIComponent("品川")) ? [{ name: "品川", code: "11203", lng: 139.73, lat: 35.62 }] : [],
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  push.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

const kawaguchi = muniSummary({ code: "11203", name: "川口市", kana: "かわぐちし" });
const kawagoe = muniSummary({ code: "11201", name: "川越市", kana: "かわごえし" });
const urawa = muniSummary({
  code: "11107", name: "浦和区", level: "ward", parentCode: "11100",
  displayName: "さいたま市浦和区", kana: "さいたましうらわく",
});
const munakata = muniSummary({ code: "40220", pref: "fukuoka", name: "宗像市", kana: "むなかたし" });

function setup() {
  render(<HeroSearch munis={[kawaguchi, kawagoe, urawa, munakata]} />);
  return { input: screen.getByRole("combobox") };
}

describe("HeroSearch", () => {
  it("初期状態では候補リストを出さない", () => {
    setup();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("入力した文字で候補を絞り込み、都道府県コンテキストを添える", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    const option = screen.getByRole("option");
    expect(within(option).getByText("川口市")).toBeInTheDocument();
    expect(within(option).getByText("埼玉県")).toBeInTheDocument();
  });

  it("候補クリックで自治体詳細ページへ遷移する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    await user.click(screen.getByRole("option"));
    expect(push).toHaveBeenCalledWith("/area/saitama/11203");
  });

  it("↓キー＋Enter で選択中の候補ページへ遷移する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/area/saitama/11201"); // 2件目=川越市
  });

  it("政令市の区は displayName でもヒットし、遷移先は区ページ", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "さいたま市浦和");
    await user.click(screen.getByRole("option"));
    expect(push).toHaveBeenCalledWith("/area/saitama/11107");
  });

  it("Escape で候補を閉じる", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("候補行の右端に「{名前}を地図で表示」ボタンが出る（区は displayName）", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    expect(screen.getByRole("button", { name: "川口市を地図で表示" })).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "浦和");
    expect(screen.getByRole("button", { name: "さいたま市浦和区を地図で表示" })).toBeInTheDocument();
  });

  it("ひらがな・カタカナの読みでも候補に出る（むなかた → 宗像市）", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "むなかた");
    expect(within(screen.getByRole("option")).getByText("宗像市")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "ムナカタ");
    expect(within(screen.getByRole("option")).getByText("宗像市")).toBeInTheDocument();
  });

  it("町丁名で「自治体名（町丁名）」の候補が出て、クリックで詳細ページへ遷移する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "日の里");
    // 町丁検索はデバウンス付きの API 呼び出しなので候補の出現を待つ
    const option = await screen.findByRole("option");
    expect(within(option).getByText("宗像市")).toBeInTheDocument();
    expect(within(option).getByText("（日の里）")).toBeInTheDocument();
    await user.click(option);
    expect(push).toHaveBeenCalledWith("/area/fukuoka/40220");
  });

  it("町丁検索が失敗した時は、別クエリに前回の町丁候補を持ち越さない", async () => {
    const user = userEvent.setup();
    let calls = 0;
    // 1回目（日の里）は成功、2回目（川口）は失敗を返す町丁検索 API のモック
    const flakyFetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return { ok: true, json: async () => ({ towns: [{ code: "40220", town: "日の里" }] }) };
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", flakyFetch);
    const { input } = setup();

    await user.type(input, "日の里");
    await screen.findByText("（日の里）");

    // 実ブラウザの「選択→貼り付け／一括置換」を模して、2文字未満を経由せず直接
    // 別クエリへ書き換える（1文字ずつ打つと2文字未満を経由して townHits が
    // 別経路でクリアされ、検証したい「失敗レスポンスでの取りこぼし」を再現できない）
    fireEvent.change(input, { target: { value: "川口" } });
    await screen.findByText("川口市"); // ローカル一致は即時に出る
    // 町丁検索の失敗レスポンスが返るまで待ち、前回（宗像市・日の里）の候補が
    // 無関係な新しいクエリの結果に混ざって残らないことを確認する
    await waitFor(() => expect(screen.queryByText("（日の里）")).toBeNull());
    expect(screen.queryByText("宗像市")).toBeNull();
  });

  it("地図ピンのクリックは詳細ページへ遷移せず、MAP_FLY_EVENT を dispatch して候補を閉じる", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    const flyCodes: string[] = [];
    const onFly = (e: Event) => flyCodes.push((e as CustomEvent<MapFlyDetail>).detail.code);
    window.addEventListener(MAP_FLY_EVENT, onFly);
    try {
      await user.click(screen.getByRole("button", { name: "川口市を地図で表示" }));
    } finally {
      window.removeEventListener(MAP_FLY_EVENT, onFly);
    }
    expect(push).not.toHaveBeenCalled();
    expect(flyCodes).toEqual(["11203"]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("駅名で「自治体名（駅名）」の候補が出て、地図ピンは駅座標付きでフライトを依頼する", async () => {
    const user = userEvent.setup();
    const { input } = setup();

    await user.type(input, "品川");
    const option = await screen.findByRole("option");
    expect(within(option).getByText("川口市")).toBeInTheDocument();
    expect(within(option).getByText("（品川駅）")).toBeInTheDocument();

    const flyDetails: MapFlyDetail[] = [];
    const onFly = (e: Event) => flyDetails.push((e as CustomEvent<MapFlyDetail>).detail);
    window.addEventListener(MAP_FLY_EVENT, onFly);
    try {
      await user.click(screen.getByRole("button", { name: "品川駅を地図で表示" }));
    } finally {
      window.removeEventListener(MAP_FLY_EVENT, onFly);
    }
    expect(push).not.toHaveBeenCalled();
    expect(flyDetails).toEqual([{ code: "11203", station: { name: "品川", lng: 139.73, lat: 35.62 } }]);
  });

  it("駅行の本体クリックはその自治体の詳細ページへ遷移する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "品川");
    await user.click(await screen.findByRole("option"));
    expect(push).toHaveBeenCalledWith("/area/saitama/11203");
  });

  it("選択した自治体が「最近見た自治体」として次回フォーカス時に出る", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    await user.click(screen.getByRole("option"));
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(input);
    expect(screen.getByText("最近見た自治体")).toBeInTheDocument();
    expect(within(screen.getByRole("option")).getByText("川口市")).toBeInTheDocument();
  });

  it("履歴のクリアボタンで履歴が消える", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    await user.click(screen.getByRole("option"));
    await user.click(input);
    expect(screen.getByText("最近見た自治体")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /クリア/ }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
