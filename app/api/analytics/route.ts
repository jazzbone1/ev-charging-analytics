import { NextResponse } from 'next/server';

import { aggregate } from '@/lib/aggregate';
import { getCached, setCached } from '@/lib/cache';
import { config, shouldUseMock } from '@/lib/config';
import { fetchChargingRecords } from '@/lib/ev-api';
import { generateMockRaw } from '@/lib/mock';
import { normalizeRecords } from '@/lib/normalize';
import type { AnalyticsFilters, AnalyticsResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 성공한 실데이터 집계 결과를 10분간 캐시(느린 API 재호출 방지)
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(f: AnalyticsFilters): string {
  return JSON.stringify([
    f.region ?? '',
    f.district ?? '',
    f.stationName ?? '',
    f.startDate ?? '',
    f.endDate ?? '',
    f.maxPages ?? '',
  ]);
}

function parseFilters(searchParams: URLSearchParams): AnalyticsFilters {
  const get = (k: string) => {
    const v = searchParams.get(k);
    return v && v.trim() ? v.trim() : undefined;
  };
  const maxPagesRaw = Number.parseInt(searchParams.get('maxPages') ?? '', 10);
  return {
    region: get('region'),
    district: get('district'),
    stationName: get('stationName'),
    startDate: get('startDate'),
    endDate: get('endDate'),
    maxPages: Number.isFinite(maxPagesRaw) ? maxPagesRaw : undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);
  const notes: string[] = [];

  // 1) 목업 모드
  if (shouldUseMock()) {
    notes.push(
      config.serviceKey
        ? 'USE_MOCK 설정이 켜져 있어 목업(가짜) 데이터를 표시합니다.'
        : '인증키(EV_API_SERVICE_KEY)가 설정되지 않아 목업(가짜) 데이터를 표시합니다.',
    );
    const rows = generateMockRaw(filters);
    const records = normalizeRecords(rows);
    return NextResponse.json(aggregate(records, 'mock', rows.length, notes));
  }

  // 2) 캐시된 실데이터가 있으면 즉시 반환(느린 API 재호출 방지)
  const key = cacheKey(filters);
  const cached = getCached<AnalyticsResponse>(key, CACHE_TTL_MS);
  if (cached) {
    return NextResponse.json({
      ...cached,
      notes: [...cached.notes, '캐시된 실 데이터입니다(최대 10분).'],
    });
  }

  // 3) 실제 공공데이터 API
  try {
    const { rows, totalCount } = await fetchChargingRecords(filters);
    if (rows.length === 0) {
      notes.push('조건에 해당하는 데이터가 없습니다. 필터를 조정해 보세요.');
    }
    const records = normalizeRecords(rows);
    const result = aggregate(records, 'live', totalCount, notes);
    if (rows.length > 0) setCached(key, result); // 성공 결과만 캐시
    return NextResponse.json(result);
  } catch (err) {
    // 실패 시 목업으로 폴백하되, 원인을 명확히 안내
    const message = err instanceof Error ? err.message : String(err);
    notes.push(`실 데이터 호출 실패로 목업 데이터를 표시합니다: ${message}`);
    const rows = generateMockRaw(filters);
    const records = normalizeRecords(rows);
    return NextResponse.json(aggregate(records, 'mock', rows.length, notes), {
      status: 200,
    });
  }
}
