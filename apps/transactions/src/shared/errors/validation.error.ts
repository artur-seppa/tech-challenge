import { DomainError } from './domain-error';

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';
}
