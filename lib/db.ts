// Postgres 연결 및 스키마 (서버 전용)
//
// DATABASE_URL 이 있으면 DB 모드가 활성화됩니다. (Railway Postgres 플러그인이
// 자동으로 DATABASE_URL 을 주입합니다.) 없으면 앱은 live/mock 로 동작합니다.

import { Pool, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;
let schemaReady = false;

export function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL 이 설정되지 않았습니다.');
    // Railway 내부 연결은 보통 SSL 불필요. 외부/공개 연결이면 PGSSL=require 로 켜기.
    const ssl =
      process.env.PGSSL === 'require'
        ? { rejectUnauthorized: false }
        : undefined;
    pool = new Pool({ connectionString, ssl, max: 5, idleTimeoutMillis: 30000 });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}

/** 테이블/인덱스를 멱등하게 생성 (최초 1회) */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS charging_records (
      id                 BIGSERIAL PRIMARY KEY,
      dedupe_key         TEXT NOT NULL UNIQUE,
      station_name       TEXT NOT NULL DEFAULT '',
      station_id         TEXT NOT NULL DEFAULT '',
      charger_id         TEXT NOT NULL DEFAULT '',
      station_type_large TEXT NOT NULL DEFAULT '',
      station_type_small TEXT NOT NULL DEFAULT '',
      charger_type       TEXT NOT NULL DEFAULT '',
      capacity           TEXT NOT NULL DEFAULT '',
      region             TEXT NOT NULL DEFAULT '',
      district           TEXT NOT NULL DEFAULT '',
      address            TEXT NOT NULL DEFAULT '',
      start_at           TIMESTAMPTZ,
      end_at             TIMESTAMPTZ,
      amount_kwh         DOUBLE PRECISION NOT NULL DEFAULT 0,
      duration_min       INTEGER NOT NULL DEFAULT 0,
      ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_cr_start_at ON charging_records (start_at);`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_cr_region ON charging_records (region);`,
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_cr_district ON charging_records (district);`,
  );
  await query(`
    CREATE TABLE IF NOT EXISTS ingest_runs (
      id           BIGSERIAL PRIMARY KEY,
      started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at  TIMESTAMPTZ,
      start_page   INTEGER NOT NULL DEFAULT 1,
      pages_done   INTEGER NOT NULL DEFAULT 0,
      rows_upserted INTEGER NOT NULL DEFAULT 0,
      total_count  INTEGER,
      done         BOOLEAN NOT NULL DEFAULT false,
      status       TEXT NOT NULL DEFAULT 'running',
      message      TEXT
    );
  `);
  schemaReady = true;
}
