import type { ZodType } from 'zod';

/**
 * Validates `payload` against `schema`, calling `onInvalid` with the failure reason and
 * returning null instead of throwing when it doesn't match. Shared by every Kafka consumer
 * that treats a malformed message as "ignore and log", not a fatal error.
 */
export function parseOrWarn<T>(
  schema: ZodType<T>,
  payload: unknown,
  onInvalid: (reason: string) => void,
): T | null {
  const result = schema.safeParse(payload);

  if (!result.success) {
    onInvalid(result.error.message);
    return null;
  }

  return result.data;
}
