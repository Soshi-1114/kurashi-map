// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import ForeignRankingTable from '@/components/foreign-resident-issues/ForeignRankingTable';
import ForeignRankingTracking from '@/components/foreign-resident-issues/ForeignRankingTracking';
import { FOREIGN_RANKINGS, type ForeignRankingRow } from '@/lib/foreignRankings';
import { track } from '@/lib/analytics';

vi.mock('@/components/SiteLink', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock('@/components/monetization/DisplayAd', () => ({ default: () => <aside aria-label="広告" className="display-ad" /> }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const rows: ForeignRankingRow[] = Array.from({ length: 120 }, (_, i) => ({
  code: `13${String(i).padStart(3, '0')}`, name: `地域${i + 1}`, pref: 'tokyo', prefName: '東京都',
  value: 120 - i, before: 100, after: 220 - i, rank: i + 1,
  mapHref: `/map/foreign-resident-issues?code=13${String(i).padStart(3, '0')}&metric=change1`,
}));
describe('new ranking table', () => {
  it('server-compatible initial view contains 100 distinct rows with one ad after the first ten', () => {
    const { container } = render(<ForeignRankingTable rows={rows} def={FOREIGN_RANKINGS[0]} year={2026} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(100);
    expect(screen.getAllByRole('complementary', { name: '広告' })).toHaveLength(1);
    const top = container.querySelector('.fr-rank-top')!;
    expect(top.children[0].querySelectorAll('tbody tr')).toHaveLength(10);
    expect(top.children[1].querySelector('aside')).not.toBeNull();
    expect(screen.getByRole('link', { name: '地域1' })).toHaveAttribute('href', rows[0].mapHref);
  });
  it('searches beyond 100 while keeping national ranks, and never shows ads on search/empty results', () => {
    render(<ForeignRankingTable rows={rows} def={FOREIGN_RANKINGS[0]} year={2026} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '地域１２０' } });
    expect(screen.getByRole('row', { name: /120.*地域120/ })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '広告' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '存在しない街' } });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('検索結果 0件');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(screen.queryByRole('complementary', { name: '広告' })).toBeNull();
  });
  it('shows unranked and zero separately, and omits ads when fewer than ten valid rows exist', () => {
    render(<ForeignRankingTable rows={[{ ...rows[0], value: 0 }, { ...rows[1], name: '欠損地域', value: null, rank: null }]} def={FOREIGN_RANKINGS[1]} year={2026} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '広告' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '欠損地域' } });
    const row = screen.getByRole('row', { name: /欠損地域/ });
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(row).getByText('算出不可')).toBeInTheDocument();
  });
  it('shows all 47 prefectures and correct school numerator/denominator headers', () => {
    render(<ForeignRankingTable rows={rows.slice(0, 47)} def={FOREIGN_RANKINGS[3]} year={2025} />);
    expect(screen.getAllByRole('link')).toHaveLength(47);
    expect(screen.getAllByRole('columnheader', { name: '在籍者総数' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: '外国籍人数' })).toHaveLength(2);
  });
});

describe('new ranking measurements', () => {
  it('tracks each view once in StrictMode, and records only allowed destination paths', () => {
    const observe = vi.fn(); let visible: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal('IntersectionObserver', class { constructor(callback: typeof visible) { visible = callback; } observe = observe; disconnect = vi.fn(); });
    render(<StrictMode><ForeignRankingTracking slug={FOREIGN_RANKINGS[0].slug} geography="municipality"><table><tbody><tr><td>データ</td></tr></tbody></table><a href="/map/foreign-resident-issues?code=11203">地図</a><a href="https://example.com">出典</a></ForeignRankingTracking></StrictMode>);
    expect(vi.mocked(track).mock.calls.filter(c => c[0] === 'new_ranking_view')).toHaveLength(1);
    visible([{ isIntersecting: true }]); visible([{ isIntersecting: true }]);
    expect(vi.mocked(track).mock.calls.filter(c => c[0] === 'new_ranking_table_view')).toHaveLength(1);
    fireEvent.click(screen.getByText('地図'));
    expect(track).toHaveBeenCalledWith('new_feature_navigation', expect.objectContaining({ destination: 'map', target_path: '/map/foreign-resident-issues' }));
    fireEvent.click(screen.getByText('出典'));
    expect(vi.mocked(track).mock.calls.filter(c => c[0] === 'new_feature_navigation')).toHaveLength(1);
  });
});
