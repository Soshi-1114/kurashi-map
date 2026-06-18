import MapView from "@/components/MapView";
import { listMunicipalities } from "@/lib/metrics";

export default async function HomePage() {
  const municipalities = await listMunicipalities("saitama");
  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <MapView municipalities={municipalities} />
    </main>
  );
}
