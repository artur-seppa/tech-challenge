'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { withSearchParams } from '../../lib/query-params';

export function Navbar() {
  // A bare `?new=1` href would replace the whole query string, dropping any active filters/page.
  // Also drop `tx`: opening "Nova transação" should always open the create drawer.
  const searchParams = useSearchParams();

  return (
    <header className="border-b border-rule bg-canvas">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-display text-sm font-semibold tracking-widest uppercase">
          ▮▮ Ledger
        </span>
        <Link
          href={`?${withSearchParams(searchParams, { new: '1', tx: undefined })}`}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
        >
          + Nova transação
        </Link>
      </div>
    </header>
  );
}
