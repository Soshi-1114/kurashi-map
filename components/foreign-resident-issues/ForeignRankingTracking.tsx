'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { track } from '@/lib/analytics';
import { FOREIGN_RANKINGS, foreignRankingPath } from '@/lib/foreignRankings';

export default function ForeignRankingTracking({ slug, geography, children }: { slug: string; geography: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);
  const tableViewed = useRef(false);
  useEffect(() => {
    let entry = 'external_or_direct';
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin) entry = referrer.pathname.startsWith('/ranking/') ? 'ranking' : referrer.pathname === '/map/foreign-resident-issues' ? 'new_map' : 'other_internal';
    } catch { /* Direct entry has no referrer. */ }
    const params = { feature_id: 'foreign-resident-issues', metric_key: slug, geography, entry_type: entry };
    if (!viewed.current) { track('new_ranking_view', params); viewed.current = true; }
    const table = root.current?.querySelector('table');
    if (!table || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (!tableViewed.current && entries.some(e => e.isIntersecting)) { tableViewed.current = true; track('new_ranking_table_view', params); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(table);
    return () => observer.disconnect();
  }, [slug, geography]);
  return <div ref={root} onClick={event => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest('a');
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const destination = url.pathname === '/map/foreign-resident-issues' ? 'map'
      : FOREIGN_RANKINGS.some(d => foreignRankingPath(d) === url.pathname) ? 'new_ranking' : null;
    if (destination) track('new_feature_navigation', { feature_id: 'foreign-resident-issues', metric_key: slug, destination, target_path: url.pathname });
  }}>{children}</div>;
}
