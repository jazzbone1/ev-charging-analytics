import { NextResponse } from 'next/server';

import { config, shouldUseMock } from '@/lib/config';
import { hasDb } from '@/lib/db';
import { runIngest } from '@/lib/ingest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// 대량 적재를 위해 넉넉한 실행 시간 (Railway/Node 환경 기준)
export const maxDuration = 300;

function intParam(v: string | null, fallback: number): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

async function handle(request: Request) {
  const { searchParams } = new URL(request.url);

  // 인증
  const expected = process.env.INGEST_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'INGEST_TOKEN 이 설정되지 않았습니다(적재 비활성).' },
      { status: 503 },
    );
  }
  const provided =
    searchParams.get('token') ?? request.headers.get('x-ingest-token') ?? '';
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
  }

  // 사전 조건
  if (!hasDb()) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL 이 설정되지 않았습니다.' },
      { status: 400 },
    );
  }
  if (shouldUseMock() || !config.serviceKey) {
    return NextResponse.json(
      { ok: false, error: '적재하려면 EV_API_SERVICE_KEY 가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    const result = await runIngest({
      startPage: intParam(searchParams.get('startPage'), 1),
      maxPages: intParam(searchParams.get('maxPages'), 200),
      timeBudgetMs: intParam(searchParams.get('timeBudgetMs'), 240000),
      pageDelayMs: intParam(searchParams.get('pageDelayMs'), 150),
    });
    return NextResponse.json({
      ok: true,
      ...result,
      hint: result.done
        ? '적재 완료. 대시보드를 새로고침하세요.'
        : `아직 남았습니다. 이어서: /api/ingest?token=...&startPage=${result.nextPage}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
