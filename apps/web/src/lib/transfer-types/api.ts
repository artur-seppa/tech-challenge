import { request } from '../api-client';
import type { TransferType } from './types';

export function listTransferTypes(): Promise<TransferType[]> {
  return request('/transfer-types');
}
