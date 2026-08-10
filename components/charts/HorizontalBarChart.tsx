'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fmtCompact } from '@/lib/format';
import { themeColors } from '@/lib/palette';
import { useTheme } from '@/components/ThemeProvider';
import { makeTooltip, type TooltipRow } from './ChartTooltip';

export interface HBarDatum {
  label: string;
  value: number;
  /** 툴팁 부가 정보 */
  meta?: Record<string, string>;
}

interface Props {
  data: HBarDatum[];
  /** 단일 값의 표시 단위 (예: 'kWh') */
  unit?: string;
  /** 값 포맷터 (기본: 콤마 + 단위) */
  valueFormatter?: (v: number) => string;
  /** 툴팁 행 커스터마이즈 */
  tooltipRows?: (d: HBarDatum) => TooltipRow[];
  /** 막대 색 (기본: primary, 단일 색 = 크기 인코딩) */
  color?: string;
  /** 왼쪽 라벨 폭 */
  labelWidth?: number;
}

export function HorizontalBarChart({
  data,
  unit = 'kWh',
  valueFormatter,
  tooltipRows,
  color,
  labelWidth = 96,
}: Props) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);
  const fmt = valueFormatter ?? ((v: number) => `${fmtCompact(v)} ${unit}`);

  if (data.length === 0) {
    return <div className="empty">표시할 데이터가 없습니다</div>;
  }

  const Tip = makeTooltip(
    (_l, payload) =>
      String((payload[0]?.payload as unknown as HBarDatum)?.label ?? ''),
    (payload) => {
      const d = payload[0]?.payload as unknown as HBarDatum;
      if (tooltipRows) return tooltipRows(d);
      return [{ label: '충전량', value: fmt(d.value) }];
    },
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
      >
        <CartesianGrid stroke={c.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => fmtCompact(v)}
          tick={{ fill: c.textMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: c.text, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={labelWidth}
        />
        <Tooltip
          content={Tip as never}
          cursor={{ fill: c.grid, opacity: 0.5 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={color ?? c.primary} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: number) => fmtCompact(v)}
            style={{ fill: c.textMuted, fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
