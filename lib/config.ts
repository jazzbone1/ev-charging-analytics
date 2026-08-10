// 환경변수 기반 런타임 설정 (서버 전용)

export const config = {
  serviceKey: process.env.EV_API_SERVICE_KEY?.trim() ?? '',
  baseUrl:
    process.env.EV_API_BASE_URL?.trim() ||
    'https://apis.data.go.kr/B552584/elcarChrsChargRcngSyrdt/getList',
  maxPages: clampInt(process.env.EV_API_MAX_PAGES, 20, 1, 100),
  forceMock: process.env.USE_MOCK === '1' || process.env.USE_MOCK === 'true',
};

/** 인증키가 없거나 강제 목업 설정이면 목업 데이터를 사용해야 하는지 */
export function shouldUseMock(): boolean {
  return config.forceMock || config.serviceKey.length === 0;
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
