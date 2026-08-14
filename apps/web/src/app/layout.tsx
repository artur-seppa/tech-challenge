import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Tech Challenge — Dashboard',
  description: 'Dashboard de transações financeiras',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
