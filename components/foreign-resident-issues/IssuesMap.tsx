"use client";

import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap, ExpressionSpecification } from 'maplibre-gl';
import { getBasemap, DEFAULT_BASEMAP } from '@/lib/mapBasemaps';
import { PREFS } from '@/lib/prefs';
import type { IssueMapRow } from '@/lib/foreignResidentIssues';

export const SEQUENTIAL = ['#e3f4f1', '#a5d8d0', '#60b5a8', '#268578', '#0b574e'];
export const DIVERGING = ['#765198', '#b5a4cd', '#eef0ed', '#79b8a1', '#20765c'];
export function mapThresholds(rows: IssueMapRow[], diverging: boolean): number[] {
  const vals = rows.flatMap(r => r.value === null ? [] : [Math.abs(r.value)]).sort((a, b) => a - b);
  const max = Math.max(1, vals.at(-1) ?? 1);
  if (diverging) return [-max / 2, 0, 0.000001, max / 2];
  return [0.2, 0.4, 0.6, 0.8].map(q => vals[Math.min(vals.length - 1, Math.floor(vals.length * q))] ?? 0);
}
export default function IssuesMap({ rows, pref, selected, onSelect, diverging }: {
  rows: IssueMapRow[]; pref: string; selected: string; onSelect: (code: string) => void; diverging: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const selectRef = useRef(onSelect);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    let instance: LibreMap | undefined;
    import('maplibre-gl').then(maplibre => {
      if (disposed || !container.current) return;
      maplibre.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');
      instance = new maplibre.Map({ container: container.current, style: getBasemap(DEFAULT_BASEMAP).style,
        center: [137, 37], zoom: 4.5, attributionControl: { compact: true } });
      map.current = instance;
      instance.addControl(new maplibre.NavigationControl(), 'top-right');
      instance.on('load', () => {
        if (disposed || !instance) return;
        instance.addSource('issues-boundaries', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        instance.addLayer({ id: 'issues-fill', type: 'fill', source: 'issues-boundaries', paint: { 'fill-color': '#dce1e6', 'fill-opacity': 0.78 } });
        instance.addLayer({ id: 'issues-line', type: 'line', source: 'issues-boundaries', paint: { 'line-color': '#607880', 'line-width': 0.5 } });
        instance.on('click', 'issues-fill', e => { const code = e.features?.[0]?.properties?.code; if (code) selectRef.current(String(code)); });
        instance.on('mouseenter', 'issues-fill', () => { if (instance) instance.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', 'issues-fill', () => { if (instance) instance.getCanvas().style.cursor = ''; });
        setGeneration(n => n + 1);
      });
      instance.on('error', () => { if (!disposed) setError('地図の一部を読み込めませんでした。数値表は引き続き利用できます。'); });
    }).catch(() => { if (!disposed) setError('地図を起動できません。下の数値表をご利用ください。'); });
    return () => { disposed = true; instance?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!generation || !map.current?.getSource('issues-boundaries')) return;
    const controller = new AbortController();
    const m = map.current;
    fetch(pref ? `/${pref}.geojson` : '/prefectures.geojson', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error('境界取得失敗');
      return r.json();
    }).then(geo => {
      if (controller.signal.aborted) return;
      const source = m.getSource('issues-boundaries') as import('maplibre-gl').GeoJSONSource;
      source.setData(geo);
      const p = PREFS.find(p => p.slug === pref);
      m.fitBounds(p?.bbox ?? [127, 30, 146, 45.8], { padding: 30, duration: 0 });
      setError('');
    }).catch(e => { if (e.name !== 'AbortError') setError('行政区域を取得できませんでした。再試行するか、数値表をご利用ください。'); });
    return () => controller.abort();
  }, [pref, generation, retry]);
  useEffect(() => {
    if (!generation || !map.current?.getSource('issues-boundaries')) return;
    const colors = diverging ? DIVERGING : SEQUENTIAL;
    const thresholds = mapThresholds(rows, diverging);
    const match: unknown[] = ['match', ['get', 'code']];
    for (const row of rows) {
      const bucket = row.value === null ? -1 : thresholds.filter(t => row.value! >= t).length;
      match.push(row.code, bucket < 0 ? '#dce1e6' : colors[bucket]);
    }
    match.push('#dce1e6');
    map.current.setPaintProperty('issues-fill', 'fill-color', rows.length ? match as ExpressionSpecification : '#dce1e6');
    map.current.setPaintProperty('issues-line', 'line-width', ['case', ['==', ['get', 'code'], selected], 3, 0.6]);
    map.current.setPaintProperty('issues-line', 'line-color', ['case', ['==', ['get', 'code'], selected], '#173e58', '#607880']);
  }, [rows, diverging, selected, generation]);
  return <div className="fri-map-wrap">
    <div ref={container} className="fri-map" role="region" aria-label="外国人住民・教育環境の地図。下の一覧からも地域を選択できます。" />
    {!generation && <p className="fri-map-message" role="status">地図を読み込んでいます。数値表からも地域を選択できます。</p>}
    {error && <div className="fri-map-message" role="status">{error}<button type="button" onClick={() => setRetry(x => x + 1)}>境界の再読込</button></div>}
  </div>;
}
