// Postgres 에 적재된 데이터를 SQL 로 집계 → AnalyticsResponse (source: 'db')

import { ensureSchema, query } from './db';
import type {
  AnalyticsFilters,
  AnalyticsResponse,
  HourPoint,
  NameValue,
  RegionPoint,
  StationPoint,
  TrendPoint,
} from './types';

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(Number(n) * f) / f;
}

function buildWhere(f: AnalyticsFilters): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (f.region) {
    params.push(f.region);
    parts.push(`region = $${params.length}`);
  }
  if (f.district) {
    params.push(`%${f.district}%`);
    parts.push(`district ILIKE $${params.length}`);
  }
  if (f.stationName) {
    params.push(`%${f.stationName}%`);
    parts.push(`station_name ILIKE $${params.length}`);
  }
  if (f.startDate) {
    params.push(f.startDate);
    parts.push(`(start_at AT TIME ZONE 'UTC')::date >= $${params.length}::date`);
  }
  if (f.endDate) {
    params.push(f.endDate);
    parts.push(`(start_at AT TIME ZONE 'UTC')::date <= $${params.length}::date`);
  }
  return { clause: parts.length ? parts.join(' AND ') : 'TRUE', params };
}

/** DB 에 적재된 데이터가 있는지 (없으면 호출부가 live/mock 로 폴백) */
export async function dbHasData(): Promise<boolean> {
  await ensureSchema();
  const r = await query<{ n: string }>(
    `SELECT count(*)::int AS n FROM charging_records`,
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

export async function analyticsFromDb(
  f: AnalyticsFilters,
  notes: string[],
): Promise<AnalyticsResponse> {
  await ensureSchema();
  const { clause, params } = buildWhere(f);

  const [
    summaryQ,
    totalQ,
    lastQ,
    trendQ,
    hourlyQ,
    regionsQ,
    districtsQ,
    chargerQ,
    capacityQ,
    stationsQ,
    regionsListQ,
  ] = await Promise.all([
    query(
      `SELECT count(*)::int AS cnt,
              COALESCE(sum(amount_kwh),0) AS total_amount,
              COALESCE(avg(amount_kwh),0) AS avg_amount,
              COALESCE(avg(NULLIF(duration_min,0)),0) AS avg_dur,
              count(DISTINCT COALESCE(NULLIF(station_id,''), station_name))::int AS stations,
              count(DISTINCT NULLIF(region,''))::int AS regions
         FROM charging_records WHERE ${clause}`,
      params,
    ),
    query(`SELECT count(*)::int AS n FROM charging_records`),
    query(`SELECT max(finished_at) AS last FROM ingest_runs WHERE status = 'ok'`),
    query(
      `SELECT to_char(start_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS d,
              COALESCE(sum(amount_kwh),0) AS amount, count(*)::int AS cnt
         FROM charging_records
        WHERE ${clause} AND start_at IS NOT NULL
        GROUP BY d ORDER BY d`,
      params,
    ),
    query(
      `SELECT EXTRACT(HOUR FROM start_at AT TIME ZONE 'UTC')::int AS h,
              COALESCE(sum(amount_kwh),0) AS amount, count(*)::int AS cnt
         FROM charging_records
        WHERE ${clause} AND start_at IS NOT NULL
        GROUP BY h`,
      params,
    ),
    query(
      `SELECT COALESCE(NULLIF(region,''),'미상') AS region,
              COALESCE(sum(amount_kwh),0) AS amount, count(*)::int AS cnt,
              count(DISTINCT COALESCE(NULLIF(station_id,''), station_name))::int AS stations
         FROM charging_records WHERE ${clause}
        GROUP BY 1 ORDER BY amount DESC LIMIT 12`,
      params,
    ),
    query(
      `SELECT COALESCE(NULLIF(district,''),'미상') AS name, COALESCE(sum(amount_kwh),0) AS value
         FROM charging_records WHERE ${clause}
        GROUP BY 1 ORDER BY value DESC LIMIT 10`,
      params,
    ),
    query(
      `SELECT COALESCE(NULLIF(charger_type,''),'기타') AS name, COALESCE(sum(amount_kwh),0) AS value
         FROM charging_records WHERE ${clause}
        GROUP BY 1 ORDER BY value DESC`,
      params,
    ),
    query(
      `SELECT COALESCE(NULLIF(capacity,''),'기타') AS name, COALESCE(sum(amount_kwh),0) AS value
         FROM charging_records WHERE ${clause}
        GROUP BY 1 ORDER BY value DESC`,
      params,
    ),
    query(
      `SELECT COALESCE(NULLIF(station_name,''), NULLIF(station_id,''), '미상') AS station_name,
              MAX(region) AS region,
              COALESCE(sum(amount_kwh),0) AS amount, count(*)::int AS cnt
         FROM charging_records WHERE ${clause}
        GROUP BY 1 ORDER BY amount DESC LIMIT 10`,
      params,
    ),
    query(
      `SELECT DISTINCT region FROM charging_records
        WHERE region <> '' ORDER BY region`,
    ),
  ]);

  const s = summaryQ.rows[0] as Record<string, unknown>;
  const matched = Number(s.cnt ?? 0);

  const trend: TrendPoint[] = trendQ.rows.map((r) => ({
    date: String((r as Record<string, unknown>).d),
    amount: round(Number((r as Record<string, unknown>).amount)),
    count: Number((r as Record<string, unknown>).cnt),
  }));

  const hourMap = new Map<number, { amount: number; count: number }>();
  for (const r of hourlyQ.rows) {
    const row = r as Record<string, unknown>;
    hourMap.set(Number(row.h), {
      amount: Number(row.amount),
      count: Number(row.cnt),
    });
  }
  const hourly: HourPoint[] = Array.from({ length: 24 }, (_, hour) => {
    const v = hourMap.get(hour) ?? { amount: 0, count: 0 };
    return { hour, amount: round(v.amount), count: v.count };
  });

  const regions: RegionPoint[] = regionsQ.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      region: String(row.region),
      amount: round(Number(row.amount)),
      count: Number(row.cnt),
      stations: Number(row.stations),
    };
  });

  const toNameValue = (rows: unknown[]): NameValue[] =>
    rows.map((r) => {
      const row = r as Record<string, unknown>;
      return { name: String(row.name), value: round(Number(row.value)) };
    });

  const topStations: StationPoint[] = stationsQ.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      stationName: String(row.station_name),
      region: String(row.region ?? ''),
      amount: round(Number(row.amount)),
      count: Number(row.cnt),
    };
  });

  const lastIngestedAt =
    (lastQ.rows[0] as Record<string, unknown>)?.last != null
      ? new Date(
          (lastQ.rows[0] as Record<string, unknown>).last as string,
        ).toISOString()
      : null;

  if (matched === 0) {
    notes.push('조건에 해당하는 데이터가 없습니다. 필터를 조정해 보세요.');
  }

  return {
    source: 'db',
    lastIngestedAt,
    sampled: matched,
    totalCount: Number((totalQ.rows[0] as Record<string, unknown>).n ?? 0),
    summary: {
      totalAmount: round(Number(s.total_amount)),
      totalCount: matched,
      avgAmountPerSession: round(Number(s.avg_amount)),
      avgDurationMin: round(Number(s.avg_dur)),
      stationCount: Number(s.stations),
      regionCount: Number(s.regions),
    },
    trend,
    hourly,
    regions,
    districts: toNameValue(districtsQ.rows),
    chargerTypes: toNameValue(chargerQ.rows),
    capacities: toNameValue(capacityQ.rows),
    topStations,
    availableRegions: regionsListQ.rows
      .map((r) => String((r as Record<string, unknown>).region))
      .filter(Boolean),
    notes,
  };
}
