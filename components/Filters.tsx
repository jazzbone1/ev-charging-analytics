'use client';

import { useEffect, useState } from 'react';

import type { AnalyticsFilters } from '@/lib/types';

export interface FilterState {
  region: string;
  district: string;
  stationName: string;
  startDate: string;
  endDate: string;
  maxPages: number;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultFilters(): FilterState {
  // 합성(과거) 데이터의 수록 기간을 미리 알 수 없으므로, 첫 화면에서는
  // 날짜 필터를 걸지 않고 전체 기간을 조회한다. (기간 프리셋으로 이후 좁힘)
  return {
    region: '',
    district: '',
    stationName: '',
    startDate: '',
    endDate: '',
    maxPages: 20,
  };
}

export function toQuery(f: FilterState): AnalyticsFilters {
  return {
    region: f.region || undefined,
    district: f.district || undefined,
    stationName: f.stationName || undefined,
    startDate: f.startDate || undefined,
    endDate: f.endDate || undefined,
    maxPages: f.maxPages,
  };
}

const PRESETS: { label: string; days: number }[] = [
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
];

interface Props {
  value: FilterState;
  availableRegions: string[];
  loading: boolean;
  onApply: (next: FilterState) => void;
}

export function Filters({ value, availableRegions, loading, onApply }: Props) {
  const [draft, setDraft] = useState<FilterState>(value);

  // 상위에서 적용된 값이 바뀌면 draft 동기화
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: v }));

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    const next = { ...draft, startDate: fmt(start), endDate: fmt(end) };
    setDraft(next);
    onApply(next);
  };

  const activePresetDays = (() => {
    const end = new Date(draft.endDate);
    const start = new Date(draft.startDate);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const match = PRESETS.find((p) => p.days === days);
    return match?.days ?? null;
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(draft);
  };

  return (
    <form className="filters" onSubmit={submit}>
      <div className="field">
        <span className="field__label">기간</span>
        <div className="chips">
          <button
            type="button"
            className={`chip${!draft.startDate && !draft.endDate ? ' chip--active' : ''}`}
            onClick={() => {
              const next = { ...draft, startDate: '', endDate: '' };
              setDraft(next);
              onApply(next);
            }}
          >
            전체 기간
          </button>
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.days}
              className={`chip${activePresetDays === p.days ? ' chip--active' : ''}`}
              onClick={() => applyPreset(p.days)}
            >
              최근 {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">시작일</span>
        <input
          type="date"
          className="input"
          value={draft.startDate}
          max={draft.endDate}
          onChange={(e) => set('startDate', e.target.value)}
        />
      </div>
      <div className="field">
        <span className="field__label">종료일</span>
        <input
          type="date"
          className="input"
          value={draft.endDate}
          min={draft.startDate}
          onChange={(e) => set('endDate', e.target.value)}
        />
      </div>

      <div className="field">
        <span className="field__label">지역</span>
        <select
          className="select"
          value={draft.region}
          onChange={(e) => set('region', e.target.value)}
        >
          <option value="">전체 지역</option>
          {availableRegions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="field__label">시군구</span>
        <input
          type="text"
          className="input"
          placeholder="예: 해남군"
          value={draft.district}
          onChange={(e) => set('district', e.target.value)}
        />
      </div>

      <div className="field">
        <span className="field__label">충전소명 검색</span>
        <input
          type="text"
          className="input"
          placeholder="충전소명 일부"
          value={draft.stationName}
          onChange={(e) => set('stationName', e.target.value)}
        />
      </div>

      <div className="field">
        <span className="field__label">집계 페이지 수</span>
        <select
          className="select"
          value={draft.maxPages}
          onChange={(e) => set('maxPages', Number(e.target.value))}
          title="page당 100건. 값이 클수록 더 많이 집계하지만 느려집니다."
        >
          {[5, 10, 20, 30, 50].map((n) => (
            <option key={n} value={n}>
              {n} 페이지 ({n * 100}건)
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn--primary" disabled={loading}>
        {loading ? '조회 중…' : '조회'}
      </button>
    </form>
  );
}
