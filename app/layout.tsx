import type { Metadata } from 'next';

import { ThemeProvider, themeInitScript } from '@/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: '전기차 충전 분석 대시보드',
  description:
    '한국환경공단 전기차 충전소 충전건별 충전량 합성데이터 기반 분석 대시보드',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
