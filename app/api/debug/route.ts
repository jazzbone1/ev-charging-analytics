import { NextResponse } from 'next/server';

import { config } from '@/lib/config';
import { fetchRawPage } from '@/lib/ev-api';
import { normalizeRecord } from '@/lib/normalize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 디버그용: 실제 공공데이터 응답 1건의 원본 필드명/값을 그대로 반환.
 * 인증키는 서버에서만 사용되며 응답에 포함되지 않습니다.
 * normalize.ts 의 필드 매핑을 실제 응답에 맞추기 위한 용도.
 */
export async function GET() {
  if (!config.serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'EV_API_SERVICE_KEY 가 필요합니다.' },
      { status: 400 },
    );
  }
  try {
    const { rows, totalCount } = await fetchRawPage(1, {}, 15000, 2);
    const sample = rows[0] ?? null;
    return NextResponse.json({
      ok: true,
      totalCount,
      returnedRows: rows.length,
      rawKeys: sample ? Object.keys(sample) : [],
      rawSample: sample,
      // 현재 매핑 결과(정규화). 값이 비면 rawSample 의 실제 키를 확인하세요.
      normalizedSample: sample ? normalizeRecord(sample) : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
