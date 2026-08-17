import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { parseOrWarn } from './parse-or-warn';

const schema = z.object({ id: z.uuid(), status: z.enum(['approved', 'rejected']) });

describe('parseOrWarn', () => {
  it('returns the parsed data when the payload matches the schema', () => {
    const onInvalid = vi.fn();
    const payload = { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', status: 'approved' };

    expect(parseOrWarn(schema, payload, onInvalid)).toEqual(payload);
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('returns null and calls onInvalid with the failure reason when the payload is malformed', () => {
    const onInvalid = vi.fn();

    const result = parseOrWarn(schema, { id: 'not-a-uuid' }, onInvalid);

    expect(result).toBeNull();
    expect(onInvalid).toHaveBeenCalledOnce();
    expect(onInvalid.mock.calls[0]?.[0]).toEqual(expect.any(String));
  });

  it('returns null when the payload is not an object at all', () => {
    const onInvalid = vi.fn();

    expect(parseOrWarn(schema, 'nope', onInvalid)).toBeNull();
    expect(onInvalid).toHaveBeenCalledOnce();
  });
});
