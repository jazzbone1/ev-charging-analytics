// 표시용 포맷 헬퍼 (클라이언트/서버 공용)

const nfKwh = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const nfInt = new Intl.NumberFormat('ko-KR');

export function fmtKwh(n: number): string {
  return `${nfKwh.format(n)} kWh`;
}

export function fmtNumber(n: number): string {
  return nfInt.format(n);
}

/** 큰 숫자를 축약 (12,345 → 12.3천, 1,234,567 → 123.5만) */
export function fmtCompact(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천`;
  return nfKwh.format(n);
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${Math.round(min)}분`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/** "2026-08-10" → "08.10" */
export function fmtShortDate(iso: string): string {
  return iso.slice(5).replace('-', '.');
}
