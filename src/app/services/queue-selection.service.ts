import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class QueueSelectionService {
  private selectedQueueSubject = new BehaviorSubject<string | null>(null);
  selectedQueue$ = this.selectedQueueSubject.asObservable();

  setSelectedQueue(queue: string) {
    this.selectedQueueSubject.next(queue);
  }

  getSelectedQueue(): string | null {
    return this.selectedQueueSubject.value;
  }
}
