import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * The single source of truth for "which queue am I looking at". This is the main piece of
 * cross-component wiring: {@link QueueDropdownComponent} (and a deep-linked route) write to
 * it via `setSelectedQueue`, and {@link MessageListComponent} subscribes to
 * `selectedQueue$` and refetches on every emission. `null` means nothing is selected yet.
 */
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
