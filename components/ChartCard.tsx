'use client';

import type { ReactNode } from 'react';

interface Props {
  title: string;
  hint?: string;
  wide?: boolean;
  tall?: boolean;
  children: ReactNode;
}

export function ChartCard({ title, hint, wide, tall, children }: Props) {
  return (
    <section className={`card${wide ? ' card--wide' : ''}`}>
      <header className="card__head">
        <h3 className="card__title">{title}</h3>
        {hint ? <span className="card__hint">{hint}</span> : null}
      </header>
      <div className={`card__body${tall ? ' card__body--tall' : ''}`}>
        {children}
      </div>
    </section>
  );
}
