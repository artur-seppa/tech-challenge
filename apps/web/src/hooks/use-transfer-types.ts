'use client';

import { useQuery } from '@tanstack/react-query';
import { listTransferTypes } from '../lib/transfer-types/api';

export function useTransferTypes() {
  return useQuery({
    queryKey: ['transfer-types'],
    queryFn: listTransferTypes,
    staleTime: Infinity,
  });
}
