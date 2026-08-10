'use client';

import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      className="btn btn--icon"
      onClick={toggle}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드' : '다크 모드'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
