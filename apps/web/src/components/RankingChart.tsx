import { useState } from 'react';
import { Select } from 'antd';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt } from './ui';
export default function RankingChart({ history }: { history: any[] }) {
  const groups = [...new Set(history.map(p => p.seasonId + ':' + p.weightClassId))]; const [scope, setScope] = useState(groups[groups.length - 1]);
  const data = history.filter(p => p.seasonId + ':' + p.weightClassId === scope);
  return <><Select aria-label="История сезона и категории" value={scope} onChange={setScope} options={groups.map((value,i) => ({ value, label: 'Период карьеры ' + (i+1) }))} /><div className="ranking-chart"><ResponsiveContainer width="100%" height={300}><LineChart data={data}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="event" tick={{fontSize:11}} /><YAxis reversed allowDecimals={false} domain={[1,'dataMax']} width={35} /><Tooltip content={({active,payload}) => { const p = payload?.[0]?.payload; return active && p ? <div className="card"><b>{p.event}</b><p>{fmt(p.date,'D MMM YYYY')}</p>#{p.previousRank ?? '—'} → #{p.rank}</div> : null; }} /><Line dataKey="rank" name="Место" stroke="#b92d25" strokeWidth={3} dot={{r:4}} /></LineChart></ResponsiveContainer></div><p className="muted">Позиция после каждого события. Сезоны и весовые категории показаны отдельно.</p></>;
}

