import { expect, test } from '@playwright/test';
import { mockTransactionFlow } from './helpers/mock-transaction-flow';

const DEBIT_ACCOUNT = '3fa85f64-5717-4562-b3fc-2c963f66afa7';
const CREDIT_ACCOUNT = '3fa85f64-5717-4562-b3fc-2c963f66afa8';

async function createTransaction(page: import('@playwright/test').Page, value: string) {
  await page.goto('/');
  await page.getByRole('link', { name: /nova transação/i }).click();

  const drawer = page.getByRole('dialog', { name: /nova transação/i });
  await drawer.getByLabel(/conta de débito/i).fill(DEBIT_ACCOUNT);
  await drawer.getByLabel(/conta de crédito/i).fill(CREDIT_ACCOUNT);
  await drawer.getByLabel(/tipo de transferência/i).selectOption({ label: 'Pagamento' });
  await drawer.getByLabel(/valor/i).fill(value);
  await drawer.getByRole('button', { name: /criar transação/i }).click();

  await expect(drawer.getByText(/transação criada com sucesso/i)).toBeVisible();
  await drawer.getByRole('button', { name: /fechar/i }).click();
}

test('reflects a transaction moving from pendente to aprovada without a page reload', async ({
  page,
}) => {
  await mockTransactionFlow(page, { finalStatus: 'approved' });
  await createTransaction(page, '500');

  const card = page.locator('li', { hasText: 'Pagamento' });
  await expect(card.getByText('Pendente')).toBeVisible();
  await expect(card.getByText('Aprovada')).toBeVisible({ timeout: 8000 });

  await card.getByRole('link').click();
  const detailDrawer = page.getByRole('dialog', { name: /detalhe da transação/i });
  await expect(detailDrawer.getByText('Aprovada')).toBeVisible({ timeout: 8000 });
});

test('reflects a transaction moving from pendente to rejeitada without a page reload', async ({
  page,
}) => {
  await mockTransactionFlow(page, { finalStatus: 'rejected' });
  await createTransaction(page, '1500');

  const card = page.locator('li', { hasText: 'Pagamento' });
  await expect(card.getByText('Pendente')).toBeVisible();
  await expect(card.getByText('Rejeitada')).toBeVisible({ timeout: 8000 });

  await card.getByRole('link').click();
  const detailDrawer = page.getByRole('dialog', { name: /detalhe da transação/i });
  await expect(detailDrawer.getByText('Rejeitada')).toBeVisible({ timeout: 8000 });
});

test('reflects a transaction moving from pendente to aprovada via a real SSE push, not the polling fallback', async ({
  page,
}) => {
  await mockTransactionFlow(page, { finalStatus: 'approved', eventsMode: 'push-single-event' });
  await createTransaction(page, '500');

  const card = page.locator('li', { hasText: 'Pagamento' });
  await expect(card.getByText('Pendente')).toBeVisible();
  // A tight timeout, well under the 3s poll interval: if this only passed because polling
  // kicked in, it would still be on "Pendente" here, since `degraded` never becomes true in
  // this mode. Distinguishes "the SSE push worked" from "the fallback saved us".
  await expect(card.getByText('Aprovada')).toBeVisible({ timeout: 2000 });
});
