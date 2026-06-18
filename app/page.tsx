import MapView from "@/components/MapView";
import { listMunicipalities } from "@/lib/metrics";

export default async function HomePage() {
  const municipalities = await listMunicipalities("saitama");
  return (
    <main style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", overflow: "hidden" }}>
      <MapView municipalities={municipalities} />
    </main>
  );
}
