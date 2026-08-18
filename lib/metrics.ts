// 自治体データのアクセス層。pref 別 JSON を動的 import で読むので、
// 47 県展開時もホームページに全データが乗らない（Next.js のコード分割で必要時のみ）。
//
// シグネチャは将来 reinfolib/e-Stat の直接呼び出しに差し替え可能な形を維持。

import { Municipality, MuniSummary } from "./types";
import { PREFS, getPrefBySlug, getPrefByCode, loadPrefData } from "./prefs";
import { floodLevelOf, landslideLevelOf, tsunamiLevelOf, stormSurgeLevelOf, liquefactionLevelOf } from "./hazardScale";
import { foreignRatioPct } from "./foreignResidents";
import { futureChangeRate2050 } from "./futurePopulation";
import muniKana from "@/data/muni-kana.json";

// 自治体のひらがな読み（検索のかな一致用）。scripts/fetch-towns.mjs が生成。
const KANA = muniKana.kana as Record<string, string>;

// pref データのキャッシュ（同一 build/request 内で同じ pref を複数回呼んでも 1 度しかロードしない）
const cache = new Map<string, Promise<{ muni: Municipality[]; wards: Municipality[] }>>();

function loadPref(slug: string) {
  const pref = getPrefBySlug(slug);
  if (!pref) return Promise.resolve({ muni: [], wards: [] });
  let p = cache.get(slug);
  if (!p) {
    p = loadPrefData(pref.slug, pref.hasWards);
    cache.set(slug, p);
  }
  return p;
}

export async function getMunicipality(code: string): Promise<Municipality | null> {
  // code prefix から pref を引き、その pref データだけロード
  const pref = getPrefByCode(code);
  if (!pref) return null;
  const { muni, wards } = await loadPref(pref.slug);
  return muni.find((m) => m.code === code) ?? wards.find((m) => m.code === code) ?? null;
}

/**
 * pref スラッグの検証つき取得。code の自治体が指定 pref に属さない場合は null。
 * /area/{pref}/{code} のように pref と code を両方受ける URL で、誤った組
 * （/area/tokyo/11203 等）が 200 を返して重複 URL 空間にならないようにする。
 */
export async function getMunicipalityIn(prefSlug: string, code: string): Promise<Municipality | null> {
  const m = await getMunicipality(code);
  return m && m.pref === prefSlug ? m : null;
}

export async function listMunicipalities(pref: string): Promise<Municipality[]> {
  return (await loadPref(pref)).muni;
}

export async function listWards(pref: string): Promise<Municipality[]> {
  return (await loadPref(pref)).wards;
}

export async function listAll(pref: string): Promise<Municipality[]> {
  const { muni, wards } = await loadPref(pref);
  return [...muni, ...wards];
}

/** 全 pref を横断して全自治体（市区町村 + 行政区）を返す。sitemap 用。 */
export async function listAllAcrossPrefs(): Promise<Municipality[]> {
  const all: Municipality[] = [];
  for (const p of PREFS) {
    const { muni, wards } = await loadPref(p.slug);
    all.push(...muni, ...wards);
  }
  return all;
}

// 人口比（%）を小数2桁に丸める。データなしセンチネル（負値）はそのまま通す。
function roundRatio(r: number): number {
  return r < 0 ? r : Math.round(r * 100) / 100;
}

/**
 * 全 pref 横断の軽量サマリ。トップ地図の初期配信用（検索・色付け・分割に必要な
 * 最小フィールドのみ）。フル Municipality（約1.8MB）を積まずに済む。
 */
export async function listSummaryAcrossPrefs(): Promise<MuniSummary[]> {
  const out: MuniSummary[] = [];
  for (const p of PREFS) {
    const { muni, wards } = await loadPref(p.slug);
    for (const m of [...muni, ...wards]) {
      const futureRate = futureChangeRate2050(m.futurePopulation);
      out.push({
        code: m.code,
        pref: m.pref,
        name: m.name,
        displayName: m.displayName,
        kana: KANA[m.code],
        level: m.level,
        parentCode: m.parentCode,
        rent: m.rent.value,
        landPrice: m.landPrice.value,
        populationTrend: m.populationTrend,
        // 人口比は小数2桁に丸めてサマリ配信を軽量化（-1=データなしはそのまま）。
        foreignRatio: roundRatio(foreignRatioPct(m)),
        // 2050年増減率は小数1桁で十分（データなしはフィールドごと省いてペイロードを増やさない）。
        ...(futureRate != null ? { futureChangeRate: Math.round(futureRate * 10) / 10 } : {}),
        floodLevel: floodLevelOf(m.hazard),
        landslideLevel: landslideLevelOf(m.hazard),
        tsunamiLevel: tsunamiLevelOf(m.hazard),
        stormSurgeLevel: stormSurgeLevelOf(m.hazard),
        liquefactionLevel: liquefactionLevelOf(m.hazard),
      });
    }
  }
  return out;
}
