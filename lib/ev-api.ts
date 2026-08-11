// 한국환경공단 전기차 충전소 충전건별 충전량 합성데이터 조회 API 클라이언트 (서버 전용)

import { config } from './config';
import type { AnalyticsFilters } from './types';

const NUM_OF_ROWS = 100; // 명세상 한 페이지 최대 100건

interface FetchResult {
  rows: Record<string, unknown>[];
  totalCount: number | null;
}

/** 필터의 YYYY-MM-DD → API가 기대하는 "YYYY-MM-DD HH:mm:ss" 형태로 변환 */
function toApiDateTime(date: string | undefined, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  return `${date} ${endOfDay ? '23:59:59' : '00:00:00'}`;
}

function buildUrl(page: number, filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  params.set('pageNo', String(page));
  params.set('numOfRows', String(NUM_OF_ROWS));
  params.set('returnType', 'JSON');
  if (filters.region) params.set('rgnNm', filters.region);
  if (filters.district) params.set('sggNm', filters.district);
  if (filters.stationName) params.set('chrsNm', filters.stationName);
  const bgn = toApiDateTime(filters.startDate, false);
  const end = toApiDateTime(filters.endDate, true);
  if (bgn) params.set('chargBgngDt', bgn);
  if (end) params.set('chargEndDt', end);

  // serviceKey 는 이미 URL 인코딩된 값일 수 있으므로 직접 붙인다(이중 인코딩 방지).
  return `${config.baseUrl}?serviceKey=${config.serviceKey}&${params.toString()}`;
}

/** data.go.kr 응답의 다양한 형태에서 item 배열과 totalCount 를 추출 */
function extractItems(json: unknown): FetchResult {
  const root = (json as { response?: unknown })?.response ?? json;
  const body = (root as { body?: unknown })?.body ?? root;

  let rows: unknown = (body as { items?: unknown })?.items;
  // items 가 { item: [...] } 형태 / 배열 / 단일 객체 인 경우 모두 처리
  if (rows && typeof rows === 'object' && !Array.isArray(rows)) {
    rows = (rows as { item?: unknown }).item;
  }
  if (!rows) rows = (body as { item?: unknown })?.item;

  let list: Record<string, unknown>[] = [];
  if (Array.isArray(rows)) list = rows as Record<string, unknown>[];
  else if (rows && typeof rows === 'object') list = [rows as Record<string, unknown>];

  const totalRaw = (body as { totalCount?: unknown })?.totalCount;
  const totalCount = Number.parseInt(String(totalRaw ?? ''), 10);

  return {
    rows: list,
    totalCount: Number.isFinite(totalCount) ? totalCount : null,
  };
}

/** 헤더의 결과코드가 정상인지 확인 (실패 시 메시지 throw) */
function assertOk(json: unknown): void {
  const header = (json as { response?: { header?: unknown } })?.response?.header as
    | { resultCode?: string; resultMsg?: string }
    | undefined;
  if (!header) return; // 헤더가 없으면 통과 (형태가 다를 수 있음)
  const code = String(header.resultCode ?? '');
  const ok = code === '' || code === '00' || code === '0000';
  if (!ok) {
    throw new Error(
      `공공데이터 API 오류 (resultCode=${code}): ${header.resultMsg ?? '알 수 없는 오류'}`,
    );
  }
}

async function fetchPage(
  page: number,
  filters: AnalyticsFilters,
  timeoutMs: number,
): Promise<FetchResult> {
  const url = buildUrl(page, filters);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // JSON 을 요청했지만 XML/평문 오류가 돌아온 경우
      throw new Error(
        `JSON 파싱 실패 (인증키/파라미터 확인 필요). 응답 일부: ${text.slice(0, 200)}`,
      );
    }
    assertOk(json);
    return extractItems(json);
  } finally {
    clearTimeout(timer);
  }
}

// 한 페이지 최대 대기 시간, 전체 호출 루프의 시간 예산, 페이지별 재시도 횟수
const PER_PAGE_TIMEOUT_MS = 12000;
const OVERALL_BUDGET_MS = 30000;
const PAGE_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 한 페이지를 재시도와 함께 가져온다(간헐적 지연/오류 대응). 실패 시 마지막 오류 throw */
async function fetchPageWithRetry(
  page: number,
  filters: AnalyticsFilters,
  deadline: number,
): Promise<FetchResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 1500) break;
    const timeoutMs = Math.max(4000, Math.min(PER_PAGE_TIMEOUT_MS, remaining));
    try {
      return await fetchPage(page, filters, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt < PAGE_RETRIES && deadline - Date.now() > 2000) {
        await sleep(400 * (attempt + 1)); // 짧은 백오프
      }
    }
  }
  throw lastErr ?? new Error('페이지 조회 실패');
}

/**
 * maxPages 만큼 순차적으로 페이지를 가져와 원본 레코드를 모은다.
 *
 * - 각 페이지는 재시도(PAGE_RETRIES)로 간헐적 지연에 대응한다.
 * - 전체 시간 예산(OVERALL_BUDGET_MS)을 두어 무한정 대기하지 않는다.
 * - 첫 페이지부터 실패하면(수집 0건) throw → 라우트가 목업으로 폴백.
 *   일부라도 받았으면(부분 성공) 그 실데이터를 사용한다.
 */
export async function fetchChargingRecords(
  filters: AnalyticsFilters,
): Promise<FetchResult> {
  const maxPages = Math.min(filters.maxPages ?? config.maxPages, config.maxPages);
  const all: Record<string, unknown>[] = [];
  let totalCount: number | null = null;
  const deadline = Date.now() + OVERALL_BUDGET_MS;

  for (let page = 1; page <= maxPages; page++) {
    if (deadline - Date.now() <= 1500 && all.length > 0) break;

    try {
      const { rows, totalCount: tc } = await fetchPageWithRetry(page, filters, deadline);
      if (tc != null) totalCount = tc;
      all.push(...rows);
      if (rows.length < NUM_OF_ROWS) break; // 마지막 페이지
      if (totalCount != null && all.length >= totalCount) break;
    } catch (err) {
      if (all.length > 0) break; // 부분 성공
      throw err; // 첫 페이지부터 실패 → 목업 폴백
    }
  }

  return { rows: all, totalCount };
}
