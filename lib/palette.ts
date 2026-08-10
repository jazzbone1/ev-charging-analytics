// 검증된 데이터 시각화 팔레트 (dataviz 기준 팔레트)
//
// 카테고리 색상은 "고정 순서"로만 배정하며 순환(cycle)하지 않습니다.
// 8개를 초과하는 계열은 "기타"로 접습니다.

export interface ThemeColors {
  categorical: string[];
  /** 단일 계열(크기 인코딩)용 기본 색 */
  primary: string;
  grid: string;
  axis: string;
  text: string;
  textMuted: string;
  surface: string;
  tooltipBg: string;
  tooltipBorder: string;
}

export const LIGHT: ThemeColors = {
  categorical: [
    '#2a78d6', // blue
    '#eb6834', // orange
    '#1baf7a', // aqua
    '#eda100', // yellow
    '#e87ba4', // magenta
    '#008300', // green
    '#4a3aa7', // violet
    '#e34948', // red
  ],
  primary: '#2a78d6',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  text: '#0b0b0b',
  textMuted: '#898781',
  surface: '#fcfcfb',
  tooltipBg: '#ffffff',
  tooltipBorder: 'rgba(11,11,11,0.10)',
};

export const DARK: ThemeColors = {
  categorical: [
    '#3987e5', // blue
    '#d95926', // orange
    '#199e70', // aqua
    '#c98500', // yellow
    '#d55181', // magenta
    '#008300', // green
    '#9085e9', // violet
    '#e66767', // red
  ],
  primary: '#3987e5',
  grid: '#2c2c2a',
  axis: '#383835',
  text: '#ffffff',
  textMuted: '#898781',
  surface: '#1a1a19',
  tooltipBg: '#242422',
  tooltipBorder: 'rgba(255,255,255,0.14)',
};

export function themeColors(isDark: boolean): ThemeColors {
  return isDark ? DARK : LIGHT;
}

/**
 * 8개 초과 카테고리를 "기타"로 접어 최대 8개(+기타) 로 만든다.
 * value 기준 내림차순 입력을 가정.
 */
export function foldOther<T extends { value: number }>(
  items: T[],
  max = 7,
  makeOther: (value: number) => T,
): T[] {
  if (items.length <= max + 1) return items;
  const head = items.slice(0, max);
  const rest = items.slice(max);
  const otherValue = rest.reduce((s, i) => s + i.value, 0);
  return [...head, makeOther(Math.round(otherValue * 10) / 10)];
}
