"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';

export interface DeptWorkload { department: string; open: number; resolved: number }

export default function WorkloadChart({ data }: { data: DeptWorkload[] }) {
  const { t } = useTranslation();
  return (
    <figure>
      <div role="img" aria-label={t('admin.workload')} style={{ height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke="#e3e5e8" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: '#475467', fontSize: 12 }} />
            <YAxis type="category" dataKey="department" width={140} tick={{ fill: '#0f1b2d', fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="open" name={t('admin.open')} fill="#9a4a07" radius={[0, 6, 6, 0]} />
            <Bar dataKey="resolved" name={t('admin.resolved')} fill="#15803d" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Screen-reader and keyboard-friendly alternative to the chart */}
      <table className="sr-only">
        <caption>{t('admin.workload')}</caption>
        <thead><tr><th scope="col">{t('admin.department')}</th><th scope="col">{t('admin.open')}</th><th scope="col">{t('admin.resolved')}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.department}><th scope="row">{d.department}</th><td>{d.open}</td><td>{d.resolved}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
