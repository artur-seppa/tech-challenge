import { describe, expect, it } from 'vitest';
import { withSearchParams } from '../../src/lib/query-params';

describe('withSearchParams', () => {
  it('adds a new key to an empty params object', () => {
    expect(withSearchParams(new URLSearchParams(), { tx: 'abc' })).toBe('tx=abc');
  });

  it('keeps existing keys that are not part of the update', () => {
    const current = new URLSearchParams('status=pending&page=2');

    expect(withSearchParams(current, { tx: 'abc' })).toBe('status=pending&page=2&tx=abc');
  });

  it('overwrites an existing key', () => {
    const current = new URLSearchParams('page=2');

    expect(withSearchParams(current, { page: '3' })).toBe('page=3');
  });

  it('removes a key when the update value is undefined', () => {
    const current = new URLSearchParams('status=pending&page=2');

    expect(withSearchParams(current, { page: undefined })).toBe('status=pending');
  });

  it('returns an empty string when nothing remains', () => {
    const current = new URLSearchParams('tx=abc');

    expect(withSearchParams(current, { tx: undefined })).toBe('');
  });

  it('does not mutate the params object passed in', () => {
    const current = new URLSearchParams('status=pending');

    withSearchParams(current, { status: undefined, page: '2' });

    expect(current.toString()).toBe('status=pending');
  });
});
