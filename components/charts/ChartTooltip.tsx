'use client';

import type { ReactNode } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/**
 * Recharts `content` prop 에 넘길 수 있는 커스텀 툴팁 렌더러를 만든다.
 * @param title  payload/label 로부터 제목을 만든다.
 * @param rows   payload 로부터 표시할 행 목록을 만든다.
 */
export function makeTooltip(
  title: (label: unknown, payload: readonly RechartsPayload[]) => string,
  rows: (payload: readonly RechartsPayload[]) => TooltipRow[],
) {
  return function TooltipContent(props: TooltipProps): ReactNode {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="tt" role="tooltip">
        <div className="tt__title">{title(label, payload)}</div>
        {rows(payload).map((r, i) => (
          <div className="tt__row" key={i}>
            {r.color ? (
              <span className="tt__swatch" style={{ background: r.color }} />
            ) : null}
            <span>{r.label}</span>
            <span className="tt__val">{r.value}</span>
          </div>
        ))}
      </div>
    );
  };
}

export interface RechartsPayload {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
  dataKey?: string | number;
}

export interface TooltipProps {
  active?: boolean;
  payload?: readonly RechartsPayload[];
  label?: string | number;
}
