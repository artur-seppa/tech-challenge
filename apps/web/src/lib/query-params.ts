export function withSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  return next.toString();
}
