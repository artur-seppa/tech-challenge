import type { Page } from '@playwright/test';

type TransactionStatusName = 'pending' | 'approved' | 'rejected';

export type EventsMode = 'degrade-to-polling' | 'push-single-event';

export interface MockTransactionFlowOptions {
  finalStatus: 'approved' | 'rejected';
  /**
   * 'degrade-to-polling' (default): the SSE connection is driven into `degraded` (5 failed
   * attempts) so the 3s polling fallback produces the status flip. 'push-single-event': the
   * SSE connection stays healthy and delivers one real event, proving the push path itself.
   */
  eventsMode?: EventsMode;
}

const TRANSACTION_ID = 'e2e0e2e0-e2e0-4e2e-8e2e-e2e0e2e0e2e0';
const TRANSFER_TYPE = { id: 1, name: 'Pagamento' };

function makeTransaction(status: TransactionStatusName, value: number) {
  return {
    transactionExternalId: TRANSACTION_ID,
    transactionType: { name: TRANSFER_TYPE.name },
    transactionStatus: { name: status },
    value,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Mocks the transactions API so the created transaction starts `pending` and eventually flips
 * to `finalStatus`, via a real SSE push or via the polling fallback (see `EventsMode`). The
 * approve/reject rule itself is covered by the anti-fraud backend's own unit tests; this only
 * proves the frontend reflects an async status change without a page reload.
 */
export async function mockTransactionFlow(
  page: Page,
  { finalStatus, eventsMode = 'degrade-to-polling' }: MockTransactionFlowOptions,
) {
  let created = false;
  let createdValue = 0;
  let visibleListCalls = 0;
  let detailCalls = 0;
  let eventsConnectionAttempts = 0;
  // Only meaningful in 'push-single-event' mode: true once the SSE event has been sent, so
  // list/detail responses flip in lockstep with the real push instead of a call-counter guess.
  let pushed = false;

  function statusFor(callCountSoFar: number): TransactionStatusName {
    if (eventsMode === 'push-single-event') {
      return pushed ? finalStatus : 'pending';
    }
    return callCountSoFar >= 2 ? finalStatus : 'pending';
  }

  await page.route('**/transfer-types', async (route) => {
    await route.fulfill({ json: [TRANSFER_TYPE] });
  });

  // Playwright's trailing `*` never crosses a `/`, so `**/transactions*` matches `/transactions`
  // and `/transactions?...` but not `/transactions/<id>`; the detail endpoint needs its own pattern.
  await page.route('**/transactions/*', async (route) => {
    detailCalls += 1;
    await route.fulfill({ json: makeTransaction(statusFor(detailCalls), createdValue) });
  });

  // `/transactions/notifications/events` has two path segments after "transactions", so
  // `**/transactions/*` above can't match it (no registration-order dependency between the two
  // routes). The app opens a real browser `EventSource` to this endpoint on every page load
  // (see `useTransactionEvents`), gating polling behind a `degraded` flag: polling only resumes
  // after 5 consecutive SSE errors.
  await page.route('**/transactions/notifications/events', async (route) => {
    if (eventsMode === 'push-single-event') {
      // Wait for the list endpoint to be re-fetched with the transaction `pending` (the
      // invalidate `useCreateTransaction`'s onSuccess triggers) before pushing the final status.
      // Waiting only on `created` races the UI: the SSE and list routes unblock off the same
      // microtask queue, so firing the push immediately can beat the "Pendente" render.
      while (!created || visibleListCalls < 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      // The pending list response only proves the browser received the data, not that React
      // painted "Pendente" yet. Firing the push right after can let the pending/approved list
      // refetches batch into one render, so "Pendente" never reaches the DOM. A short fixed
      // pause gives the "Pendente" paint room to land as its own commit first.
      await new Promise((resolve) => setTimeout(resolve, 400));
      pushed = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `retry: 60000\ndata: ${JSON.stringify({
          transactionExternalId: TRANSACTION_ID,
          status: finalStatus,
        })}\n\n`,
      });
      return;
    }

    eventsConnectionAttempts += 1;

    // Attempt 1 is a real (if minimal) SSE response: status 200, correct content-type, body
    // `retry: 50\n\n`. Ending the body right after causes the browser to treat the connection
    // as server-closed, firing a real `onerror`. Attempts 2-5 use `route.abort()` instead: a
    // closer simulation of a connection that never completes the handshake, and faster than
    // waiting on real reconnect timing each time.
    if (eventsConnectionAttempts === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'retry: 50\n\n',
      });
      return;
    }

    if (eventsConnectionAttempts <= 5) {
      await route.abort();
      return;
    }

    // From the 6th attempt onward, `degraded` is already true. Leave the connection hanging
    // forever (intentional) instead of fulfilling/aborting it: another onerror/onopen cycle
    // would fire more invalidateQueries calls, making the call-counter assertions below flaky.
    await new Promise<never>(() => {});
  });

  await page.route('**/transactions*', async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'POST') {
      created = true;
      createdValue = (JSON.parse(request.postData() ?? '{}') as { value?: number }).value ?? 0;
      await route.fulfill({ status: 201, json: makeTransaction('pending', createdValue) });
      return;
    }

    if (!created) {
      await route.fulfill({
        json: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      });
      return;
    }

    visibleListCalls += 1;
    await route.fulfill({
      json: {
        data: [makeTransaction(statusFor(visibleListCalls), createdValue)],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    });
  });
}

export { TRANSACTION_ID };
