import Link from '@/components/SiteLink';
import { formatIssueValue, type IssuesDataset } from '@/lib/foreignResidentIssues';

export default function LocalEducationNotes({ data }: { data: IssuesDataset }) {
  const records = data.localEducation ?? [];
  if (!records.length) return null;
  const codes = [...new Set(records.map(r => r.municipalityCode))];
  return <section className="fri-region-compare" aria-label="自治体の教育公表資料"><h2>自治体の公表資料（参考）</h2>
    <p>公立校を対象とする自治体資料は、国公私立計の都道府県ランキングとは別に表示します。全国で同条件の自治体別在籍割合は収録していません。</p>
    {codes.map(code => {
      const city = data.municipalities.find(m => m.code === code)!;
      const rows = records.filter(r => r.municipalityCode === code);
      return <div key={code}><h3>{city.name}・公立小中学校</h3><div className="fri-table-scroll" role="region" aria-label="自治体公表の在籍人数" tabIndex={0}><table><thead><tr><th>基準日</th><th>学校種</th><th>外国籍在籍人数</th><th>割合</th></tr></thead><tbody>{rows.map(r => <tr key={`${r.year}:${r.stage}`}><td>{r.asOf}</td><th scope="row">{r.stage === 'elementary' ? '小学校' : '中学校'}</th><td>{formatIssueValue(r.foreign)}</td><td>算出不可（分母未収録）</td></tr>)}</tbody></table></div>
        <p><Link href={`/area/${city.pref}/${code}`}>{city.name}の住環境データ</Link></p>
        {data.sources.filter(s => rows.some(r => r.sourceIds.includes(s.id))).map(s => <p key={s.id}><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.sourceName}</a> ／ <a href={s.downloadUrl} target="_blank" rel="noopener noreferrer">原典PDF（5ページ）</a><br />{s.definition}</p>)}
      </div>;
    })}
  </section>;
}
