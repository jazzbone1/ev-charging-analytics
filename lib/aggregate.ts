// 정규화된 레코드 → 대시보드 집계 데이터

import type {
  AnalyticsResponse,
  ChargingRecord,
  HourPoint,
  NameValue,
  RegionPoint,
  StationPoint,
  TrendPoint,
} from './types';

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function topN<T>(arr: T[], n: number, key: (t: T) => number): T[] {
  return [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);
}

/** 카테고리별 충전량 합계를 name/value 배열로 (내림차순) */
function sumByCategory(
  records: ChargingRecord[],
  keyFn: (r: ChargingRecord) => string,
): NameValue[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const k = keyFn(r) || '기타';
    map.set(k, (map.get(k) ?? 0) + r.amountKwh);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => b.value - a.value);
}

export function aggregate(
  records: ChargingRecord[],
  source: 'live' | 'mock',
  totalCount: number | null,
  notes: string[],
): AnalyticsResponse {
  const totalAmount = records.reduce((s, r) => s + r.amountKwh, 0);
  const totalCount0 = records.length;

  // 일별 추이
  const trendMap = new Map<string, { amount: number; count: number }>();
  // 시간대별
  const hourMap = new Map<number, { amount: number; count: number }>();
  // 지역별 (충전소 집합 포함)
  const regionMap = new Map<
    string,
    { amount: number; count: number; stations: Set<string> }
  >();
  // 상위 충전소
  const stationMap = new Map<
    string,
    { region: string; amount: number; count: number }
  >();

  const stations = new Set<string>();
  const regions = new Set<string>();
  let durationSum = 0;
  let durationCount = 0;

  for (const r of records) {
    if (r.stationId || r.stationName) stations.add(r.stationId || r.stationName);
    if (r.region) regions.add(r.region);

    if (r.durationMin > 0) {
      durationSum += r.durationMin;
      durationCount += 1;
    }

    if (r.startAt) {
      const date = r.startAt.slice(0, 10);
      const t = trendMap.get(date) ?? { amount: 0, count: 0 };
      t.amount += r.amountKwh;
      t.count += 1;
      trendMap.set(date, t);

      const hour = new Date(r.startAt).getUTCHours();
      const h = hourMap.get(hour) ?? { amount: 0, count: 0 };
      h.amount += r.amountKwh;
      h.count += 1;
      hourMap.set(hour, h);
    }

    const rk = r.region || '미상';
    const rg = regionMap.get(rk) ?? {
      amount: 0,
      count: 0,
      stations: new Set<string>(),
    };
    rg.amount += r.amountKwh;
    rg.count += 1;
    rg.stations.add(r.stationId || r.stationName);
    regionMap.set(rk, rg);

    const sk = r.stationName || r.stationId || '미상';
    const st = stationMap.get(sk) ?? {
      region: r.region,
      amount: 0,
      count: 0,
    };
    st.amount += r.amountKwh;
    st.count += 1;
    stationMap.set(sk, st);
  }

  const trend: TrendPoint[] = [...trendMap.entries()]
    .map(([date, v]) => ({
      date,
      amount: round(v.amount),
      count: v.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hourly: HourPoint[] = Array.from({ length: 24 }, (_, hour) => {
    const v = hourMap.get(hour) ?? { amount: 0, count: 0 };
    return { hour, amount: round(v.amount), count: v.count };
  });

  const regionsAgg: RegionPoint[] = [...regionMap.entries()]
    .map(([region, v]) => ({
      region,
      amount: round(v.amount),
      count: v.count,
      stations: v.stations.size,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topStations: StationPoint[] = topN(
    [...stationMap.entries()].map(([stationName, v]) => ({
      stationName,
      region: v.region,
      amount: round(v.amount),
      count: v.count,
    })),
    10,
    (s) => s.amount,
  );

  const districts = topN(
    sumByCategory(records, (r) => r.district),
    10,
    (d) => d.value,
  );

  return {
    source,
    sampled: totalCount0,
    totalCount,
    summary: {
      totalAmount: round(totalAmount),
      totalCount: totalCount0,
      avgAmountPerSession:
        totalCount0 > 0 ? round(totalAmount / totalCount0) : 0,
      avgDurationMin: durationCount > 0 ? round(durationSum / durationCount) : 0,
      stationCount: stations.size,
      regionCount: regions.size,
    },
    trend,
    hourly,
    regions: regionsAgg.slice(0, 12),
    districts,
    chargerTypes: sumByCategory(records, (r) => r.chargerType),
    capacities: sumByCategory(records, (r) => r.capacity),
    topStations,
    availableRegions: [...regions].sort((a, b) => a.localeCompare(b, 'ko')),
    notes,
  };
}
