// 아주 단순한 서버 메모리 캐시 (TTL 기반)
//
// 느린 공공데이터 API를 매 요청마다 다시 호출하지 않도록,
// 성공적으로 집계한 결과를 잠시 보관한다. (단일 인스턴스 기준)

interface Entry {
  at: number;
  value: unknown;
}

const store = new Map<string, Entry>();

export function getCached<T>(key: string, ttlMs: number): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.at > ttlMs) {
    store.delete(key);
    return null;
  }
  return e.value as T;
}

export function setCached(key: string, value: unknown): void {
  // 메모리 무한 증가 방지: 오래된 항목이 너무 많으면 정리
  if (store.size > 200) {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [k, v] of store) {
      if (v.at < cutoff) store.delete(k);
    }
  }
  store.set(key, { at: Date.now(), value });
}
