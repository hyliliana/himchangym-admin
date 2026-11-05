import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '힘찬짐 · 운영 관리', description: '힘찬짐 회원, 이용권, 예약 관리' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
