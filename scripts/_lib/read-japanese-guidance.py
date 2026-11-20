"""Stream the very wide official XLSX without loading its 280MB XML into RAM."""
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
year = int(sys.argv[2])

with zipfile.ZipFile(sys.argv[1]) as archive:
    strings = [''.join(t.text or '' for t in item.findall('s:t', NS) + item.findall('s:r/s:t', NS))
               for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
    headers = {}
    result = []
    columns = {}
    with archive.open('xl/worksheets/sheet1.xml') as stream:
        for _, row in ET.iterparse(stream, events=['end']):
            if not row.tag.endswith('}row'):
                continue
            rn = int(row.get('r'))
            values = {}
            for cell in row:
                col = re.sub(r'\d+', '', cell.get('r'))
                if rn > 6 and col not in {'A', 'B', 'C', *columns}:
                    continue
                value = cell.find('s:v', NS)
                if value is not None:
                    values[col] = strings[int(value.text)] if cell.get('t') == 's' else value.text
            if rn <= 6:
                headers[rn] = values
            if rn == 6:
                for col, question in headers[2].items():
                    stage = {'小学校': 'elementary', '中学校': 'junior'}.get(headers[5].get(col))
                    label = headers[4].get(col, '')
                    if question == '問3' and stage:
                        columns[col] = (stage, 'needsJapanese' if '日本国籍' in label else 'needsForeign')
                    if question == '問14' and stage and label.startswith('（イ）') and '（人数）' in headers[3].get(col, ''):
                        columns[col] = (stage, 'receivingForeign')
                    if question == '問30':
                        support_labels = {
                            '（ア）': '拠点校への通級による指導',
                            '（イ）': '拠点校での指導と担当教員の巡回指導',
                            '（ウ）': '日本語指導支援者・母語支援員等の巡回',
                            '（エ）': '各校に配置した教員・支援者等による指導',
                            '（オ）': '担当教員のいない学校でのICT等による遠隔教育',
                            '（カ）': '指導内容・人員配置・研修等の調整組織',
                            '（キ）': '特段の指導体制を整備していないとの回答',
                            '（ク）': 'その他の指導体制',
                        }
                        columns[col] = ('support', support_labels[label])
                for stage in ['elementary', 'junior']:
                    for metric in ['needsForeign', 'needsJapanese', 'receivingForeign']:
                        if list(columns.values()).count((stage, metric)) != 1:
                            raise ValueError('Unknown guidance table headers: ' + stage + metric)
            if rn > 7 and values.get('A') == '公立':
                pref = re.match(r'^(\d{2})', values.get('B', ''))
                city = re.match(r'^(\d{3}):', values.get('C', ''))
                if pref and city:
                    code = pref[1] + city[1]
                    support = [metric for col, (stage, metric) in columns.items()
                               if stage == 'support' and values.get(col) == '1']
                    for stage in ['elementary', 'junior']:
                        item = {'code': code, 'year': year, 'stage': stage, 'support': support}
                        for col, (st, metric) in columns.items():
                            if st == stage:
                                raw = values.get(col, '')
                                item[metric] = int(raw) if re.fullmatch(r'\d+', raw) else None
                        result.append(item)
            row.clear()
    print(json.dumps(result, ensure_ascii=False))
