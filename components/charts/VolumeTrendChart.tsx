'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fmtCompact, fmtNumber, fmtShortDate } from '@/lib/format';
import { themeColors } from '@/lib/palette';
import { useTheme } from '@/components/ThemeProvider';
import type { TrendPoint } from '@/lib/types';
import { makeTooltip } from './ChartTooltip';

const Tip = makeTooltip(
  (label) => `${label}`,
  (payload) => {
    const p = payload[0]?.payload as TrendPoint | undefined;
    return [
      { label: '충전량', value: `${fmtNumber(p?.amount ?? 0)} kWh`, color: undefined },
      { label: '건수', value: `${fmtNumber(p?.count ?? 0)}건` },
    ];
  },
);

export function VolumeTrendChart({ data }: { data: TrendPoint[] }) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);

  if (data.length === 0) {
    return <div className="empty">표시할 데이터가 없습니다</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.primary} stopOpacity={0.28} />
            <stop offset="100%" stopColor={c.primary} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.grid} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtShortDate}
          tick={{ fill: c.textMuted, fontSize: 11.5 }}
          axisLine={{ stroke: c.axis }}
          tickLine={false}
          minTickGap={28}
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
          cursor={{ stroke: c.axis, strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke={c.primary}
          strokeWidth={2}
          fill="url(#trendFill)"
          activeDot={{ r: 4, strokeWidth: 0 }}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
