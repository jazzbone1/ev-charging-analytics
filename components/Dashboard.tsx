'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ChartCard } from './ChartCard';
import { Filters, defaultFilters, toQuery, type FilterState } from './Filters';
import { StatCards } from './StatCards';
import { ThemeToggle } from './ThemeToggle';
import { DonutChart } from './charts/DonutChart';
import { HorizontalBarChart, type HBarDatum } from './charts/HorizontalBarChart';
import { HourlyChart } from './charts/HourlyChart';
import { VolumeTrendChart } from './charts/VolumeTrendChart';
import { fmtNumber } from '@/lib/format';
import type { AnalyticsResponse } from '@/lib/types';

function buildUrl(f: FilterState): string {
  const q = toQuery(f);
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v != null && v !== '') params.set(k, String(v));
  });
  return `/api/analytics?${params.toString()}`;
}

export function Dashboard() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (f: FilterState) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl(f), { cache: 'no-store' });
      if (!res.ok) throw new Error(`요청 실패 (HTTP ${res.status})`);
      const json = (await res.json()) as AnalyticsResponse;
      if (id === reqId.current) setData(json);
    } catch (e) {
      if (id === reqId.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (next: FilterState) => {
    setFilters(next);
    load(next);
  };

  const regionBars: HBarDatum[] =
    data?.regions.map((r) => ({
      label: r.region,
      value: r.amount,
      meta: {
        건수: `${fmtNumber(r.count)}건`,
        충전소: `${fmtNumber(r.stations)}개소`,
      },
    })) ?? [];

  const capacityBars: HBarDatum[] =
    data?.capacities.map((cp) => ({ label: cp.name, value: cp.value })) ?? [];

  const stationBars: HBarDatum[] =
    data?.topStations.map((s) => ({
      label: s.stationName,
      value: s.amount,
      meta: { 지역: s.region, 건수: `${fmtNumber(s.count)}건` },
    })) ?? [];

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__logo" aria-hidden>
            ⚡
          </div>
          <div>
            <h1 className="app-header__title">전기차 충전 분석 대시보드</h1>
            <p className="app-header__subtitle">
              한국환경공단 · 충전소 충전건별 충전량 합성데이터
            </p>
          </div>
          <div className="app-header__spacer" />
          {data ? (
            <span className={`badge badge--${data.source === 'live' ? 'live' : 'mock'}`}>
              <span className="badge__dot" />
              {data.source === 'live' ? '실 데이터' : '목업 데이터'}
            </span>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <main className="container" style={{ paddingTop: 22, paddingBottom: 8 }}>
        <div className="stack">
          <Filters
            value={filters}
            availableRegions={data?.availableRegions ?? []}
            loading={loading}
            onApply={apply}
          />

          {error ? (
            <div className="note" style={{ borderLeftColor: '#d03b3b' }}>
              <span>⚠️</span>
              <span>데이터를 불러오지 못했습니다: {error}</span>
            </div>
          ) : null}

          {data?.notes.map((n, i) => (
            <div className="note" key={i}>
              <span>ℹ️</span>
              <span>{n}</span>
            </div>
          ))}

          {loading && !data ? (
            <LoadingSkeleton />
          ) : data ? (
            <>
              <StatCards summary={data.summary} />

              <div className="chart-grid">
                <ChartCard
                  title="일별 충전량 추이"
                  hint={`집계 ${fmtNumber(data.sampled)}건${
                    data.totalCount ? ` / 전체 ${fmtNumber(data.totalCount)}건` : ''
                  }`}
                  wide
                  tall
                >
                  <VolumeTrendChart data={data.trend} />
                </ChartCard>

                <ChartCard title="시간대별 충전량" hint="0~23시">
                  <HourlyChart data={data.hourly} />
                </ChartCard>

                <ChartCard title="충전기 유형별 비중" hint="충전량 기준">
                  <DonutChart data={data.chargerTypes} maxSlices={2} />
                </ChartCard>

                <ChartCard title="지역별 충전량" hint="상위 12개 지역">
                  <HorizontalBarChart
                    data={regionBars}
                    tooltipRows={(d) => [
                      { label: '충전량', value: `${fmtNumber(d.value)} kWh` },
                      { label: '건수', value: d.meta?.건수 ?? '-' },
                      { label: '충전소', value: d.meta?.충전소 ?? '-' },
                    ]}
                  />
                </ChartCard>

                <ChartCard title="충전기 용량 구분별 충전량" hint="충전량 기준">
                  <HorizontalBarChart data={capacityBars} labelWidth={80} />
                </ChartCard>

                <ChartCard
                  title="상위 충전소 (충전량)"
                  hint="TOP 10"
                  wide
                >
                  <HorizontalBarChart
                    data={stationBars}
                    labelWidth={200}
                    tooltipRows={(d) => [
                      { label: '충전량', value: `${fmtNumber(d.value)} kWh` },
                      { label: '지역', value: d.meta?.지역 ?? '-' },
                      { label: '건수', value: d.meta?.건수 ?? '-' },
                    ]}
                  />
                </ChartCard>
              </div>
            </>
          ) : null}
        </div>
      </main>

      <footer className="app-footer">
        데이터 출처: 공공데이터포털 · 한국환경공단 전기차 충전소 충전건별 충전량
        합성데이터 조회서비스
      </footer>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="stack">
      <div className="stat-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 92 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 340 }} />
      <div className="chart-grid">
        <div className="skeleton" style={{ height: 300 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    </div>
  );
}
