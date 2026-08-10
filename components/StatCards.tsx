'use client';

import { fmtCompact, fmtDuration, fmtNumber } from '@/lib/format';
import type { AnalyticsSummary } from '@/lib/types';

interface StatDef {
  label: string;
  value: string;
  unit?: string;
}

export function StatCards({ summary }: { summary: AnalyticsSummary }) {
  const stats: StatDef[] = [
    { label: '총 충전량', value: fmtCompact(summary.totalAmount), unit: 'kWh' },
    { label: '총 충전 건수', value: fmtNumber(summary.totalCount), unit: '건' },
    {
      label: '건당 평균 충전량',
      value: fmtNumber(summary.avgAmountPerSession),
      unit: 'kWh',
    },
    { label: '평균 충전 시간', value: fmtDuration(summary.avgDurationMin) },
    { label: '충전소 수', value: fmtNumber(summary.stationCount), unit: '개소' },
    { label: '지역 수', value: fmtNumber(summary.regionCount), unit: '개' },
  ];

  return (
    <div className="stat-grid">
      {stats.map((s) => (
        <div className="stat" key={s.label}>
          <div className="stat__label">{s.label}</div>
          <div className="stat__value">
            {s.value}
            {s.unit ? <span className="stat__unit">{s.unit}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
