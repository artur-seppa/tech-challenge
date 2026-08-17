'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTransaction } from '../lib/transactions/api';
import type { CreateTransactionInput } from '../lib/transactions/api';

export interface CreateTransactionVariables {
  input: CreateTransactionInput;
  idempotencyKey: string;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CreateTransactionVariables) =>
      createTransaction(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
