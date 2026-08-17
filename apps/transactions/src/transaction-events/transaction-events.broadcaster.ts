import { Injectable } from '@nestjs/common';
import type { TransactionStatusUpdatedEvent } from '@tech-challenge/contracts';
import { Subject, type Observable } from 'rxjs';

@Injectable()
export class TransactionEventsBroadcaster {
  private readonly subject = new Subject<TransactionStatusUpdatedEvent>();

  emit(event: TransactionStatusUpdatedEvent): void {
    this.subject.next(event);
  }

  stream(): Observable<TransactionStatusUpdatedEvent> {
    return this.subject.asObservable();
  }
}
