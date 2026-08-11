// 공공데이터 API → Postgres 적재 (서버 전용)
//
// 전체 페이지를 순회하며 정규화 후 upsert(중복 무시)한다.
// 대용량 대비: 한 번 호출에서 maxPages/timeBudget 로 제한하고, 미완료 시
// nextPage 를 반환하여 이어받기(chunked ingest)를 지원한다.

import { ensureSchema, query } from './db';
import { fetchRawPage } from './ev-api';
import { normalizeRecords } from './normalize';
import type { ChargingRecord } from './types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface IngestOptions {
  startPage?: number;
  /** 이번 호출에서 처리할 최대 페이지 수 */
  maxPages?: number;
  /** 이번 호출의 시간 예산(ms) */
  timeBudgetMs?: number;
  /** 페이지 간 지연(ms) — API 부하 완화 */
  pageDelayMs?: number;
}

export interface IngestResult {
  startPage: number;
  pagesDone: number;
  rowsUpserted: number;
  totalCount: number | null;
  done: boolean;
  nextPage: number | null;
  elapsedMs: number;
}

/** dedupe_key: 트랜잭션 1건을 유일하게 식별 (재적재 안전) */
function dedupeKey(r: ChargingRecord): string {
  return [r.stationId, r.chargerId, r.startAt ?? '', r.endAt ?? '', r.amountKwh].join(
    '|',
  );
}

const COLS = 14; // 아래 INSERT 컬럼 수와 반드시 일치

async function upsertBatch(records: ChargingRecord[]): Promise<number> {
  if (records.length === 0) return 0;
  const values: unknown[] = [];
  const tuples: string[] = [];
  records.forEach((r, i) => {
    const b = i * COLS;
    tuples.push(
      `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14})`,
    );
    values.push(
      dedupeKey(r),
      r.stationName,
      r.stationId,
      r.chargerId,
      r.stationTypeLarge,
      r.stationTypeSmall,
      r.chargerType,
      r.capacity,
      r.region,
      r.district,
      r.address,
      r.startAt,
      r.endAt,
      r.amountKwh,
    );
  });
  const sql = `
    INSERT INTO charging_records
      (dedupe_key, station_name, station_id, charger_id, station_type_large,
       station_type_small, charger_type, capacity, region, district, address,
       start_at, end_at, amount_kwh)
    VALUES ${tuples.join(',')}
    ON CONFLICT (dedupe_key) DO NOTHING
  `;
  const res = await query(sql, values);
  return res.rowCount ?? 0;
}

// duration_min 은 start/end 로부터 채운다(별도 컬럼 업데이트)
async function backfillDurations(): Promise<void> {
  await query(`
    UPDATE charging_records
    SET duration_min = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (end_at - start_at)) / 60))::int
    WHERE duration_min = 0 AND start_at IS NOT NULL AND end_at IS NOT NULL
  `);
}

export async function runIngest(opts: IngestOptions = {}): Promise<IngestResult> {
  const startPage = Math.max(1, opts.startPage ?? 1);
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? 200, 5000));
  const timeBudgetMs = Math.max(10000, Math.min(opts.timeBudgetMs ?? 240000, 280000));
  const pageDelayMs = Math.max(0, opts.pageDelayMs ?? 150);

  await ensureSchema();

  const runStart = Date.now();
  const deadline = runStart + timeBudgetMs;
  const runRow = await query<{ id: string }>(
    `INSERT INTO ingest_runs (start_page, status) VALUES ($1, 'running') RETURNING id`,
    [startPage],
  );
  const runId = runRow.rows[0]?.id;

  let page = startPage;
  let pagesDone = 0;
  let rowsUpserted = 0;
  let totalCount: number | null = null;
  let done = false;
  let errorMsg: string | null = null;

  try {
    const BATCH = 500;
    let buffer: ChargingRecord[] = [];

    while (pagesDone < maxPages && Date.now() < deadline) {
      const { rows, totalCount: tc } = await fetchRawPage(page, {}, 15000, 2);
      if (tc != null) totalCount = tc;
      if (rows.length === 0) {
        done = true;
        break;
      }
      buffer.push(...normalizeRecords(rows));
      if (buffer.length >= BATCH) {
        rowsUpserted += await upsertBatch(buffer.splice(0, buffer.length));
      }
      pagesDone++;
      const last = rows.length < 100;
      page++;
      if (last) {
        done = true;
        break;
      }
      if (totalCount != null && (page - 1) * 100 >= totalCount) {
        done = true;
        break;
      }
      if (pageDelayMs > 0) await sleep(pageDelayMs);
    }

    if (buffer.length > 0) {
      rowsUpserted += await upsertBatch(buffer);
    }
    await backfillDurations();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  const nextPage = done ? null : page;
  await query(
    `UPDATE ingest_runs
       SET finished_at = now(), pages_done = $2, rows_upserted = $3,
           total_count = $4, done = $5, status = $6, message = $7
     WHERE id = $1`,
    [
      runId,
      pagesDone,
      rowsUpserted,
      totalCount,
      done,
      errorMsg ? 'error' : 'ok',
      errorMsg,
    ],
  );

  if (errorMsg && rowsUpserted === 0) {
    throw new Error(errorMsg);
  }

  return {
    startPage,
    pagesDone,
    rowsUpserted,
    totalCount,
    done,
    nextPage,
    elapsedMs: Date.now() - runStart,
  };
}
