// 원본 공공데이터 응답 → 정규화된 ChargingRecord 로 변환
//
// ⚠️  공공데이터 응답의 실제 필드명은 서비스/환경에 따라 다를 수 있습니다.
//     아래 FIELD_CANDIDATES 는 "논리적 필드 → 가능성 있는 원본 키 목록" 입니다.
//     실제 응답의 키가 목록에 없다면 여기에 추가만 하면 됩니다.

import type { ChargingRecord } from './types';

const FIELD_CANDIDATES = {
  stationName: ['chrsNm', 'statNm', 'stationNm', 'csNm', '충전소명'],
  stationId: ['chrsId', 'statId', 'stationId', 'csId', '충전소아이디'],
  chargerId: ['chgerId', 'chargerId', 'chrgrId', 'cpId', '충전기아이디'],
  stationTypeLarge: [
    'chrsTypeLclsNm', // ← 실제 응답 (예: "기타시설")
    'chrsTyLcls',
    'chrsTypeLcls',
    'statTyLcls',
    'csTyLcls',
    'busiTyNm',
    '충전소유형대분류',
  ],
  stationTypeSmall: [
    'chrsTypeMclsfNm', // ← 실제 응답 (중분류, 예: "군부대")
    'chrsTyScls',
    'chrsTypeScls',
    'statTyScls',
    'csTyScls',
    '충전소유형소분류',
  ],
  chargerType: [
    'chrsTypeNm', // ← 실제 응답 (예: "DC콤보")
    'chgerType',
    'chargerType',
    'chgerTypeNm',
    'cpTypeNm',
    'chrgrTyNm',
    '충전기유형명',
  ],
  capacity: [
    'chargCoctSeNm', // ← 실제 응답 (예: "급속(200kW동시)")
    'chrgrCapaNm',
    'capaNm',
    'chgerCapa',
    'capacity',
    'output',
    '충전기용량구분명',
  ],
  region: ['rgnNm', 'sidoNm', 'metroNm', 'zcode', 'zscodeNm', '지역명'],
  district: ['sggNm', 'sigunguNm', 'zscode', 'zscodeNm', '시군구명'],
  address: ['addr', 'adres', 'address', 'roadAddr', '주소'],
  startAt: ['chargBgngDt', 'chargeStartDt', 'startDt', 'bgngDt', '충전시작일시'],
  endAt: ['chargEndDt', 'chargeEndDt', 'endDt', '충전종료일시'],
  amount: [
    'totChargRcngQnt', // ← 실제 응답 (충전량, 예: "30.07")
    'chargAmt',
    'chargeAmt',
    'chrgAmt',
    'chargQty',
    'kwh',
    'chargeKwh',
    '충전량',
  ],
  // 충전시간: 실제 응답은 totChargHr 이며 "HH:MM:SS" 형식 → 분으로 파싱
  duration: ['totChargHr', 'chargTime', 'chargeTime', 'chrgTime', 'durationMin', '충전시간'],
} as const;

type LogicalField = keyof typeof FIELD_CANDIDATES;

function pick(row: Record<string, unknown>, field: LogicalField): unknown {
  for (const key of FIELD_CANDIDATES[field]) {
    if (key in row && row[key] != null && row[key] !== '') return row[key];
  }
  return undefined;
}

function toStr(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  return String(v).trim() || fallback;
}

/** "1,234.5", "1234", 1234, "3.2kWh" 등을 숫자로 파싱 */
function toNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * "2024-01-29 16:46:00", "20240129164600", ISO 문자열 등을 파싱해
 * ISO 문자열로 반환. 파싱 실패 시 null.
 */
export function parseDateTime(v: unknown): string | null {
  if (v == null || v === '') return null;
  const raw = String(v).trim();

  // 순수 숫자 형태 (YYYYMMDDHHmmss / YYYYMMDDHHmm / YYYYMMDD)
  if (/^\d{8,14}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const mo = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const h = raw.slice(8, 10) || '00';
    const mi = raw.slice(10, 12) || '00';
    const s = raw.slice(12, 14) || '00';
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }

  // "YYYY-MM-DD HH:mm:ss" → ISO
  const normalized = raw.replace(' ', 'T');
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * 충전시간 값을 "분"으로 파싱.
 * - "HH:MM:SS" / "HH:MM" (예: totChargHr "00:00:01") → 분 환산
 * - 숫자/숫자문자열 → 분으로 간주
 */
function parseDurationToMinutes(v: unknown): number {
  if (v == null || v === '') return 0;
  const s = String(v).trim();
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => Number.parseInt(p, 10) || 0);
    let h = 0;
    let m = 0;
    let sec = 0;
    if (parts.length >= 3) [h, m, sec] = parts;
    else if (parts.length === 2) [h, m] = parts;
    else [m] = parts;
    return Math.round(h * 60 + m + sec / 60);
  }
  return Math.max(0, toNumber(s));
}

/** 명시적 duration 필드(우선) 또는 시작/종료 시각 차이로 충전 시간(분)을 계산 */
function resolveDuration(
  durationRaw: unknown,
  startAt: string | null,
  endAt: string | null,
): number {
  const explicit = parseDurationToMinutes(durationRaw);
  if (explicit > 0) return explicit;
  if (startAt && endAt) {
    const diff = (Date.parse(endAt) - Date.parse(startAt)) / 60000;
    if (Number.isFinite(diff) && diff > 0) return Math.round(diff);
  }
  return 0;
}

export function normalizeRecord(
  row: Record<string, unknown>,
): ChargingRecord {
  const startAt = parseDateTime(pick(row, 'startAt'));
  const endAt = parseDateTime(pick(row, 'endAt'));

  return {
    stationName: toStr(pick(row, 'stationName'), '미상'),
    stationId: toStr(pick(row, 'stationId')),
    chargerId: toStr(pick(row, 'chargerId')),
    stationTypeLarge: toStr(pick(row, 'stationTypeLarge'), '기타'),
    stationTypeSmall: toStr(pick(row, 'stationTypeSmall'), '기타'),
    chargerType: toStr(pick(row, 'chargerType'), '기타'),
    capacity: toStr(pick(row, 'capacity'), '기타'),
    region: toStr(pick(row, 'region'), '미상'),
    district: toStr(pick(row, 'district'), '미상'),
    address: toStr(pick(row, 'address')),
    startAt,
    endAt,
    amountKwh: Math.max(0, toNumber(pick(row, 'amount'))),
    durationMin: resolveDuration(pick(row, 'duration'), startAt, endAt),
  };
}

export function normalizeRecords(
  rows: Record<string, unknown>[],
): ChargingRecord[] {
  return rows.map(normalizeRecord);
}
