import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({ value: z.number().positive() });

describe('ZodValidationPipe', () => {
  it('returns the parsed value when it matches the schema', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(pipe.transform({ value: 10 })).toEqual({ value: 10 });
  });

  it('throws BadRequestException when the value does not match the schema', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform({ value: -10 })).toThrow(BadRequestException);
  });
});
