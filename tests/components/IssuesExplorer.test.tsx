// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import IssuesExplorer from '@/components/foreign-resident-issues/IssuesExplorer';

vi.mock('next/dynamic', () => ({ default: () => () => <div>地図テスト用</div> }));
const dataset = JSON.parse(readFileSync('public/foreign-resident-issues/dataset.json', 'utf8'));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('independent explorer', () => {
  it('restores the municipality, period and metric, then switches to education at its own year', async () => {
    window.history.replaceState(null, '', '/map/foreign-resident-issues?tab=residents&year=2026&pref=saitama&code=11203&metric=rate5');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dataset }));
    render(<IssuesExplorer />);
    const detail = await screen.findByRole('complementary', { name: '選択地域の詳細' });
    await waitFor(() => expect(within(detail).getByRole('heading', { name: '川口市' })).toBeInTheDocument());
    expect(screen.getByLabelText('指標')).toHaveValue('rate5');
    expect(screen.getByLabelText('基準年')).toHaveValue('2026');
    const filterToggle = screen.getByRole('button', { name: /条件を変更/ });
    expect(filterToggle).toHaveAttribute('aria-expanded', 'false');
    expect(filterToggle).toHaveAttribute('aria-controls', 'fri-display-controls');
    fireEvent.click(filterToggle);
    expect(filterToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('指標')).toHaveValue('rate5');
    fireEvent.click(filterToggle);
    expect(filterToggle).toHaveAttribute('aria-expanded', 'false');
    const chart = within(detail).getByRole('img', { name: /縦軸の単位は%/ });
    expect(within(chart).getByText('0%')).toBeInTheDocument();
    expect(chart.querySelectorAll('line').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: '学校の教育環境' }));
    expect(screen.getByLabelText('基準年')).toHaveValue('2025');
    expect(screen.getByLabelText('学校種')).toHaveValue('elementary');
    expect(within(detail).queryByRole('heading', { name: '川口市' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '日本語指導・支援' }));
    expect(screen.getByLabelText('日本語指導指標')).toHaveValue('needsForeign');
    const kawaguchi = screen.getByRole('button', { name: '川口市' });
    fireEvent.click(kawaguchi);
    expect(within(detail).getAllByText('1,209人').length).toBeGreaterThan(0);
    expect(within(detail).getByText('78人')).toBeInTheDocument();
    expect(within(detail).getByText('981人')).toBeInTheDocument();
    expect(within(detail).getByText('拠点校への通級による指導')).toBeInTheDocument();
  });
  it('exposes a usable retry after data-fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, json: async () => dataset }));
    render(<IssuesExplorer />);
    expect(await screen.findByRole('alert')).toHaveTextContent('統計データを取得できませんでした');
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(await screen.findByRole('button', { name: '学校の教育環境' })).toBeInTheDocument();
  });
  it('shows all education metrics and keeps header sorting, filters and URL in sync', async () => {
    window.history.replaceState(null, '', '/map/foreign-resident-issues?tab=education');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => dataset }));
    render(<IssuesExplorer />);
    const region = await screen.findByRole('region', { name: '地域別の全指標比較表' });
    await waitFor(() => expect(within(region).getAllByRole('columnheader')).toHaveLength(6));
    fireEvent.click(within(region).getByRole('button', { name: '外国籍生徒数（中学校）の高い順に並べ替え' }));
    expect(screen.getByLabelText('学校種')).toHaveValue('junior');
    expect(screen.getByLabelText('教育指標')).toHaveValue('count');
    expect(region.querySelector('th[aria-sort="descending"]')).toHaveTextContent('外国籍生徒数（中学校）');
    const first = region.querySelector('tbody tr')!;
    expect(first).toHaveTextContent('東京都');
    expect(first).toHaveTextContent('17,193人');
    expect(first).toHaveTextContent('6,782人');
    await waitFor(() => expect(window.location.search).toContain('stage=junior'));
    expect(window.location.search).toContain('educationMetric=count');
    fireEvent.change(screen.getByLabelText('教育指標'), { target: { value: 'ratio' } });
    expect(region.querySelector('th[aria-sort="descending"]')).toHaveTextContent('外国籍生徒割合（中学校）');
  });
});
