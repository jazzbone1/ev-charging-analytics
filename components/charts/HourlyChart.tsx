'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fmtCompact, fmtNumber } from '@/lib/format';
import { themeColors } from '@/lib/palette';
import { useTheme } from '@/components/ThemeProvider';
import type { HourPoint } from '@/lib/types';
import { makeTooltip } from './ChartTooltip';

const Tip = makeTooltip(
  (label) => `${label}시`,
  (payload) => {
    const p = payload[0]?.payload as HourPoint | undefined;
    return [
      { label: '충전량', value: `${fmtNumber(p?.amount ?? 0)} kWh` },
      { label: '건수', value: `${fmtNumber(p?.count ?? 0)}건` },
    ];
  },
);

export function HourlyChart({ data }: { data: HourPoint[] }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="hour"
          tickFormatter={(h: number) => (h % 3 === 0 ? `${h}` : '')}
          tick={{ fill: c.textMuted, fontSize: 11.5 }}
          axisLine={{ stroke: c.axis }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tickFormatter={fmtCompact}
          tick={{ fill: c.textMuted, fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          content={Tip as never}
          cursor={{ fill: c.grid, opacity: 0.5 }}
        />
        <Bar
          dataKey="amount"
          fill={c.primary}
          radius={[4, 4, 0, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
