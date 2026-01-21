import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkillBound - OSRS Progression Tracker',
  description: 'Track your Old School RuneScape character progression',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
