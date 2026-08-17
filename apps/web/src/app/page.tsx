'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import { Navbar } from '../components/layout/navbar';
import { CreateTransactionForm } from '../components/transactions/create-transaction-form';
import { TransactionDetail } from '../components/transactions/transaction-detail';
import { TransactionFilters } from '../components/transactions/transaction-filters';
import { TransactionList } from '../components/transactions/transaction-list';
import { Drawer } from '../components/ui/drawer';
import { withSearchParams } from '../lib/query-params';
import type {
  TransactionFilters as Filters,
  TransactionStatusName,
} from '../lib/transactions/types';

const PAGE_SIZE = 9;

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Carregando…</p>}>
      <PageContent />
    </Suspense>
  );
}

// Filters/page live in the URL, not in useState: a single source of truth that makes the
// list's state shareable/bookmarkable and restores correctly on browser back/forward.
function parseFilters(searchParams: URLSearchParams): Filters {
  const status = searchParams.get('status');
  const transferTypeId = searchParams.get('transferTypeId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  return {
    ...(status !== null && { status: status as TransactionStatusName }),
    ...(transferTypeId !== null && { transferTypeId: Number(transferTypeId) }),
    ...(from !== null && { from }),
    ...(to !== null && { to }),
  };
}

function PageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = parseFilters(searchParams);
  const page = Number(searchParams.get('page') ?? '1');
  const openTransactionId = searchParams.get('tx');
  const isCreateOpen = !openTransactionId && searchParams.get('new') === '1';

  // `replace`, not `push`: a filter tweak or a page click shouldn't add its own history entry.
  const replaceParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const query = withSearchParams(searchParams, updates);
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const handleFiltersChange = (next: Filters) => {
    replaceParams({
      status: next.status,
      transferTypeId: next.transferTypeId !== undefined ? String(next.transferTypeId) : undefined,
      from: next.from,
      to: next.to,
      page: undefined,
    });
  };

  const handlePageChange = (nextPage: number) => {
    replaceParams({ page: nextPage === 1 ? undefined : String(nextPage) });
  };

  // Drawer open/close keeps `push` (a real navigation, worth a back-button step), but only
  // touches tx/new, unlike the old `router.push(pathname)`, so filters/page survive.
  const closeDrawer = useCallback(() => {
    const query = withSearchParams(searchParams, { tx: undefined, new: undefined });
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams]);

  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 p-8">
        <h1 className="font-display text-2xl font-semibold">Transações</h1>

        <TransactionFilters filters={filters} onChange={handleFiltersChange} />

        <TransactionList
          filters={filters}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
        />
      </main>

      <Drawer open={Boolean(openTransactionId)} onClose={closeDrawer} title="Detalhe da transação">
        {openTransactionId && <TransactionDetail id={openTransactionId} />}
      </Drawer>

      <Drawer open={isCreateOpen} onClose={closeDrawer} title="Nova transação">
        <CreateTransactionForm />
      </Drawer>
    </>
  );
}
