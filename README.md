# ⚡ 전기차 충전 분석 대시보드

한국환경공단 **전기차 충전소 충전건별 충전량 합성데이터 조회서비스**(공공데이터포털,
서비스 `B552584/elcarChrsChargRcngSyrdt`)를 기반으로 한 **Next.js 분석 대시보드**입니다.

충전 트랜잭션 데이터를 서버에서 집계하여 다음을 시각화합니다.

- 총 충전량 / 충전 건수 / 건당 평균 / 평균 충전 시간 / 충전소·지역 수 (요약 카드)
- **일별 충전량 추이** (에어리어 차트)
- **시간대별 충전량** (0~23시)
- **충전기 유형별 비중** (도넛)
- **지역별 충전량** (상위 12개)
- **충전기 용량 구분별 충전량**
- **상위 충전소 TOP 10**

기간 · 지역 · 시군구 · 충전소명 검색 필터, 라이트/다크 모드를 지원합니다.

---

## 빠른 시작

```bash
# 1) 의존성 설치
npm install          # 또는 pnpm install / yarn

# 2) 환경변수 설정
cp .env.example .env
#   .env 파일을 열고 EV_API_SERVICE_KEY 에 data.go.kr 인증키를 입력

# 3) 개발 서버 실행
npm run dev
#   http://localhost:3000
```

> **인증키가 없어도 동작합니다.** `EV_API_SERVICE_KEY` 가 비어 있으면 명세와 동일한
> 구조의 **목업(가짜) 데이터**로 대시보드가 완전히 렌더링됩니다. 헤더의 배지로
> `실 데이터` / `목업 데이터` 여부를 확인할 수 있습니다.

---

## 환경변수

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `EV_API_SERVICE_KEY` | data.go.kr 인증키(Encoding 키 그대로) | (없음 → 목업) |
| `EV_API_BASE_URL` | API 엔드포인트 | `…/B552584/elcarChrsChargRcngSyrdt/getList` |
| `EV_API_MAX_PAGES` | 집계 시 가져올 최대 페이지 수(page당 100건) | `20` |
| `USE_MOCK` | `1` 이면 키가 있어도 목업 사용 | (없음) |
| `DATABASE_URL` | Postgres 연결 문자열(설정 시 **DB 모드**) | (없음) |
| `PGSSL` | 외부 연결 SSL 필요 시 `require` | (없음) |
| `INGEST_TOKEN` | `/api/ingest` 보호 토큰 | (없음 → 적재 비활성) |

인증키는 **서버 라우트에서만** 사용되며 브라우저로 노출되지 않습니다.

### 데이터 출처 우선순위

대시보드(`/api/analytics`)는 다음 순서로 데이터를 결정합니다(헤더 배지로 표시):

1. `USE_MOCK=1` → **목업**
2. `DATABASE_URL` 있고 적재된 데이터 존재 → **DB**(SQL 집계, 전체·빠름·무폴백)
3. 인증키 있음 → **실시간 API**(표본, 10분 캐시)
4. 그 외 → **목업**

---

## 아키텍처

```
브라우저 (Dashboard, 차트) ──fetch──▶ /api/analytics
                                          │  ├─ db-analytics.ts  ← DB 있으면 SQL 집계 (source:'db')
                                          │  ├─ ev-api.ts        ← 아니면 실시간 API (source:'live', 캐시)
                                          │  ├─ mock.ts          ← 그 외 목업 (source:'mock')
                                          │  └─ aggregate.ts     집계 → 차트용 시리즈

                            /api/ingest ──▶ ingest.ts → normalize → db.ts (Postgres upsert)
```

- `app/api/analytics/route.ts` — DB → 실시간 API → 목업 순으로 데이터 출처를 결정.
- `app/api/ingest/route.ts` — 토큰 보호 적재 트리거(이어받기 지원).
- `lib/` — 순수 로직(정규화·집계·목업·API 클라이언트·DB·SQL 집계·포맷·팔레트).
- `components/` — 대시보드 UI와 Recharts 차트. 색은 검증된 시각화 팔레트(색맹 안전).

---

## ⚠️ 원본 응답 필드명 조정

공공데이터 응답의 실제 JSON 필드명은 API 환경/조건에 따라 다를 수 있습니다.
이 프로젝트는 `lib/normalize.ts` 의 `FIELD_CANDIDATES` 에서 **논리 필드마다 여러
후보 키**를 탐색하는 방식으로 방어합니다.

실 데이터를 연결한 뒤 특정 값(예: 충전량, 충전기 유형)이 비어 보인다면:

1. 실제 응답 1건을 확인합니다(브라우저에서 `/api/analytics?maxPages=1` 응답 또는 API 원본).
2. 해당 값의 **실제 키 이름**을 `lib/normalize.ts` 의 알맞은 배열에 추가합니다.

이 한 파일만 수정하면 전체 대시보드가 올바르게 매핑됩니다.

---

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run typecheck` | 타입 검사 |

---

## Railway 배포

이 저장소는 **Railway** 자동 배포에 맞춰 설정되어 있습니다(`railway.json`).

1. [railway.app](https://railway.app) 로그인 → **New Project** → **Deploy from GitHub repo**
2. `jazzbone1/ev-charging-analytics` 선택 (Railway가 Next.js를 자동 감지 → `npm run build` / `npm run start`)
3. 서비스 → **Variables** 탭에서 환경변수 추가:
   - `EV_API_SERVICE_KEY` = data.go.kr 인증키 (없으면 목업 데이터로 동작)
   - (선택) `EV_API_MAX_PAGES`, `USE_MOCK`
4. 서비스 → **Settings → Networking → Generate Domain** 으로 공개 URL 생성
5. 생성된 `https://*.up.railway.app` 주소로 접속

> `start` 스크립트가 Railway가 주입하는 `$PORT` 로 바인딩
> (`next start -H 0.0.0.0 -p $PORT`)하도록 되어 있어 별도 설정 없이 헬스체크를 통과합니다.

---

## 전체 데이터 적재 (DB 모드)

실시간 API는 느리고 표본만 봅니다. **Postgres에 전체를 미리 적재**하면 대시보드가
DB만 조회하여 **빠르고, 전체 데이터이며, 폴백이 없습니다**. API는 적재할 때만 호출합니다.

```
[적재]  /api/ingest → 공공데이터 전체 페이지 순회 → Postgres upsert(중복 무시)
[조회]  /api/analytics → Postgres SQL 집계 (source: 'db')
```

**Railway 설정**

1. 프로젝트에서 **New → Database → Add PostgreSQL** (Railway가 `DATABASE_URL` 자동 주입)
2. 웹 서비스 **Variables** 에 다음 추가:
   - `INGEST_TOKEN` = 임의의 긴 문자열(적재 API 보호용)
   - `EV_API_SERVICE_KEY` = data.go.kr 인증키
   - (Postgres가 같은 프로젝트라면 `DATABASE_URL` 은 보통 자동 연결됨)
3. **적재 실행** — 브라우저나 터미널에서:
   ```
   https://<앱주소>/api/ingest?token=<INGEST_TOKEN>
   ```
   - 응답에 `done:true` 면 완료. `done:false` 면 `nextPage` 로 이어서 호출:
     ```
     https://<앱주소>/api/ingest?token=<INGEST_TOKEN>&startPage=<nextPage>
     ```
   - `maxPages`, `timeBudgetMs`, `pageDelayMs` 로 한 번에 처리할 양을 조절할 수 있습니다.
4. 적재 후 대시보드를 새로고침하면 배지가 **`DB 데이터`** 로 바뀝니다.

**자동 갱신(선택)** — Railway **Cron** 서비스나 외부 스케줄러로 매일 아래를 호출:
```
curl -s "https://<앱주소>/api/ingest?token=<INGEST_TOKEN>"
```
중복은 `dedupe_key` 로 무시되므로 매일 실행해도 안전합니다(멱등).

> 스키마(`charging_records`, `ingest_runs`)는 최초 호출 시 자동 생성됩니다.
> 데이터가 아주 많으면 첫 적재만 `startPage` 로 여러 번 나눠 실행하세요.

---

## 데이터 출처

[공공데이터포털](https://www.data.go.kr) — 한국환경공단 전기차 충전소 충전건별
충전량 합성데이터 조회서비스. 이용 시 출처 표기 및 각 서비스의 이용약관을 따르세요.
