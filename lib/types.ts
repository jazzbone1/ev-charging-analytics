// 도메인 타입 정의
//
// 공공데이터 원본 응답의 필드명은 명세에 따라 달라질 수 있으므로,
// normalize.ts 에서 아래의 "정규화된" 형태(ChargingRecord)로 변환한 뒤
// 앱 전체는 이 정규화 타입만 사용합니다.

/** 정규화된 충전 1건 레코드 */
export interface ChargingRecord {
  /** 충전소명 */
  stationName: string;
  /** 충전소 아이디 */
  stationId: string;
  /** 충전기 아이디 */
  chargerId: string;
  /** 충전소 유형 대분류 (예: 공용/개인) */
  stationTypeLarge: string;
  /** 충전소 유형 소분류 */
  stationTypeSmall: string;
  /** 충전기 유형명 (예: 급속/완속/DC콤보) */
  chargerType: string;
  /** 충전기 용량 구분명 (예: 100kW급) */
  capacity: string;
  /** 지역명 (시/도) */
  region: string;
  /** 시군구명 */
  district: string;
  /** 주소 */
  address: string;
  /** 충전 시작 일시 (ISO 문자열) */
  startAt: string | null;
  /** 충전 종료 일시 (ISO 문자열) */
  endAt: string | null;
  /** 충전량 (kWh) */
  amountKwh: number;
  /** 충전 시간 (분) */
  durationMin: number;
}

export interface AnalyticsFilters {
  region?: string;
  district?: string;
  stationName?: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  /** 집계에 사용할 최대 페이지 수 (page당 100건) */
  maxPages?: number;
}

export interface NameValue {
  name: string;
  value: number;
}

export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string;
  /** 총 충전량 (kWh) */
  amount: number;
  /** 충전 건수 */
  count: number;
}

export interface HourPoint {
  /** 0 ~ 23 */
  hour: number;
  amount: number;
  count: number;
}

export interface RegionPoint {
  region: string;
  amount: number;
  count: number;
  stations: number;
}

export interface StationPoint {
  stationName: string;
  region: string;
  amount: number;
  count: number;
}

export interface AnalyticsSummary {
  totalAmount: number;
  totalCount: number;
  avgAmountPerSession: number;
  avgDurationMin: number;
  stationCount: number;
  regionCount: number;
}

export interface AnalyticsResponse {
  /** 데이터 출처: 실제 공공데이터 API 응답 vs 목업 */
  source: 'live' | 'mock';
  /** 집계에 사용된 레코드 수 */
  sampled: number;
  /** API가 보고한 전체 레코드 수 (있는 경우) */
  totalCount: number | null;
  summary: AnalyticsSummary;
  trend: TrendPoint[];
  hourly: HourPoint[];
  regions: RegionPoint[];
  districts: NameValue[];
  chargerTypes: NameValue[];
  capacities: NameValue[];
  topStations: StationPoint[];
  /** 필터 드롭다운을 채우기 위한 사용 가능한 지역 목록 */
  availableRegions: string[];
  /** 사람이 읽을 수 있는 경고/안내 메시지 */
  notes: string[];
}
