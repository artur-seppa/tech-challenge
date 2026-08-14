export const TOPICS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_STATUS_UPDATED: 'transaction.status.updated',
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
