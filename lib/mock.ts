// 목업(가짜) 데이터 생성기
//
// 인증키가 없어도 대시보드가 완전히 동작하도록, 명세의 컬럼 구조를 그대로 흉내낸
// 합성 데이터를 생성합니다. 시드 기반 PRNG 로 만들어 재현 가능합니다.

import type { AnalyticsFilters, ChargingRecord } from './types';

// 시드 기반 PRNG (mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGIONS: { region: string; districts: string[] }[] = [
  { region: '서울특별시', districts: ['강남구', '송파구', '마포구', '영등포구', '성동구'] },
  { region: '경기도', districts: ['성남시', '수원시', '고양시', '용인시', '화성시'] },
  { region: '인천광역시', districts: ['연수구', '남동구', '부평구', '서구'] },
  { region: '부산광역시', districts: ['해운대구', '부산진구', '동래구', '사하구'] },
  { region: '대구광역시', districts: ['수성구', '달서구', '북구'] },
  { region: '대전광역시', districts: ['유성구', '서구', '중구'] },
  { region: '광주광역시', districts: ['광산구', '북구', '서구'] },
  { region: '전라남도', districts: ['순천시', '여수시', '목포시', '해남군'] },
  { region: '경상남도', districts: ['창원시', '김해시', '진주시'] },
  { region: '강원특별자치도', districts: ['춘천시', '원주시', '강릉시'] },
];

const CHARGER_TYPES = [
  { type: '급속', capacity: '50kW급', weight: 3 },
  { type: '급속', capacity: '100kW급', weight: 2 },
  { type: '급속', capacity: '200kW급', weight: 1 },
  { type: '완속', capacity: '7kW급', weight: 4 },
  { type: '완속', capacity: '11kW급', weight: 2 },
];

const STATION_TYPE_LARGE = ['공용', '비공용'];
const STATION_TYPE_SMALL = [
  '아파트',
  '공영주차장',
  '마트',
  '관공서',
  '고속도로 휴게소',
  '주유소',
];

function weightedPick<T extends { weight: number }>(rng: () => number, items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtDateTime(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * 요청 필터(기간/지역 등)에 맞는 목업 원본 레코드(원본 응답 형태의 객체) 배열을 생성.
 * normalize.ts 가 소화할 수 있도록 명세의 필드명을 사용합니다.
 */
export function generateMockRaw(
  filters: AnalyticsFilters,
  count = 1200,
): Record<string, unknown>[] {
  // 시드: 필터 조합에 따라 결정적 → 같은 필터엔 같은 데이터
  const seedStr = `${filters.region ?? ''}|${filters.district ?? ''}|${filters.startDate ?? ''}|${filters.endDate ?? ''}`;
  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const rng = mulberry32(seed);

  const end = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : new Date();
  const start = filters.startDate
    ? new Date(`${filters.startDate}T00:00:00`)
    : new Date(end.getTime() - 29 * 86400000);
  const span = Math.max(1, end.getTime() - start.getTime());

  const regionPool = filters.region
    ? REGIONS.filter((r) => r.region === filters.region)
    : REGIONS;
  const pool = regionPool.length > 0 ? regionPool : REGIONS;

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const regionEntry = pool[Math.floor(rng() * pool.length)];
    const district = filters.district
      ? filters.district
      : regionEntry.districts[Math.floor(rng() * regionEntry.districts.length)];

    const ct = weightedPick(rng, CHARGER_TYPES);
    const isFast = ct.type === '급속';

    // 시작 시각: 기간 내 랜덤. 낮 시간대에 가중치 (출퇴근/낮 이용).
    const dayBias = Math.pow(rng(), 0.8);
    const startMs = start.getTime() + dayBias * span;
    const startDate = new Date(startMs);
    // 시간대: 07~21시에 몰리도록
    const hour = Math.min(23, Math.max(0, Math.round(7 + rng() * 14 + (rng() - 0.5) * 6)));
    startDate.setHours(hour, Math.floor(rng() * 60), Math.floor(rng() * 60), 0);

    // 충전량 & 시간
    const amount = isFast
      ? round(8 + rng() * 42) // 급속: 8~50 kWh
      : round(3 + rng() * 17); // 완속: 3~20 kWh
    const durationMin = isFast
      ? Math.round(10 + rng() * 40)
      : Math.round(60 + rng() * 300);
    const endDate = new Date(startDate.getTime() + durationMin * 60000);

    const stationIdx = 1 + Math.floor(rng() * 60);
    const stationName = `${district} ${STATION_TYPE_SMALL[stationIdx % STATION_TYPE_SMALL.length]} 충전소 ${stationIdx}`;

    rows.push({
      chrsNm: stationName,
      chrsId: `ST${regionEntry.region.slice(0, 2)}${pad(stationIdx)}`,
      chgerId: pad(1 + Math.floor(rng() * 6)),
      chrsTyLcls: STATION_TYPE_LARGE[Math.floor(rng() * STATION_TYPE_LARGE.length)],
      chrsTyScls: STATION_TYPE_SMALL[stationIdx % STATION_TYPE_SMALL.length],
      chgerType: ct.type,
      chrgrCapaNm: ct.capacity,
      rgnNm: regionEntry.region,
      sggNm: district,
      addr: `${regionEntry.region} ${district} ${1 + Math.floor(rng() * 200)}`,
      chargBgngDt: fmtDateTime(startDate),
      chargEndDt: fmtDateTime(endDate),
      chargAmt: amount,
      chargTime: durationMin,
    });
  }
  return rows;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 이미 정규화된 목업 레코드가 필요할 때의 편의 함수 (테스트/직접 사용) */
export type { ChargingRecord };
