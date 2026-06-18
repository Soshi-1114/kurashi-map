import { Municipality } from "./types";
import saitama from "../data/saitama.json";

const MUNI = saitama as unknown as Municipality[];

// ★将来：これらの中身をreinfolib/e-Stat呼び出しに差し替える。シグネチャは変えない。
export async function getMunicipality(code: string): Promise<Municipality | null> {
  return MUNI.find((m) => m.code === code) ?? null;
}
export async function listMunicipalities(pref: string): Promise<Municipality[]> {
  return MUNI.filter((m) => m.pref === pref);
}
