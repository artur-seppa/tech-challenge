import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../errors/domain-error';
import { NotFoundError } from '../errors/not-found.error';
import { ValidationError } from '../errors/validation.error';
import { DomainExceptionFilter } from './domain-exception.filter';

class UnmappedDomainError extends DomainError {
  readonly code = 'SOMETHING_ELSE';
}

function makeHostMock() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  it('maps NotFoundError to 404', () => {
    const { host, status, json } = makeHostMock();

    filter.catch(new NotFoundError('transaction not found'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      error: 'NOT_FOUND',
      message: 'transaction not found',
    });
  });

  it('maps ValidationError to 400', () => {
    const { host, status } = makeHostMock();

    filter.catch(new ValidationError('invalid payload'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('maps an unmapped DomainError code to 500', () => {
    const { host, status } = makeHostMock();

    filter.catch(new UnmappedDomainError('unexpected'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
