'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { fmtNumber } from '@/lib/format';
import { foldOther, themeColors } from '@/lib/palette';
import { useTheme } from '@/components/ThemeProvider';
import type { NameValue } from '@/lib/types';
import { makeTooltip } from './ChartTooltip';

interface Props {
  data: NameValue[];
  unit?: string;
  /** 파이/도넛은 all-pairs 폼이므로 카테고리 3개(+기타)로 제한 */
  maxSlices?: number;
}

export function DonutChart({ data, unit = 'kWh', maxSlices = 2 }: Props) {
  const { isDark } = useTheme();
  const c = themeColors(isDark);

  const folded = foldOther<NameValue>(data, maxSlices, (value) => ({
    name: '기타',
    value,
  }));
  const total = folded.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return <div className="empty">표시할 데이터가 없습니다</div>;
  }

  const colorFor = (i: number, name: string) =>
    name === '기타' ? c.textMuted : c.categorical[i % c.categorical.length];

  const Tip = makeTooltip(
    (_l, payload) => String(payload[0]?.name ?? ''),
    (payload) => {
      const v = Number(payload[0]?.value ?? 0);
      const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0';
      return [
        {
          label: '충전량',
          value: `${fmtNumber(v)} ${unit}`,
          color: payload[0]?.color,
        },
        { label: '비중', value: `${pct}%` },
      ];
    },
  );

  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: '1 1 60%', height: '100%', minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={folded}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              stroke={c.surface}
              strokeWidth={2}
            >
              {folded.map((d, i) => (
                <Cell key={i} fill={colorFor(i, d.name)} />
              ))}
            </Pie>
            <Tooltip content={Tip as never} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul
        style={{
          flex: '1 1 40%',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {folded.map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
          return (
            <li
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <span
                className="legend__swatch"
                style={{ background: colorFor(i, d.name) }}
              />
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{d.name}</span>
              <span
                style={{
                  marginLeft: 'auto',
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
