import { Component, OnInit } from '@angular/core';
import {QueueService} from "../../services/queue.service";
import {QueueSelectionService} from "../../services/queue-selection.service";
import {ToastService} from "../../services/toast.service";


/**
 * The queue picker. Loads the queue names, restores the user's last-used queue on init
 * (unless a route has already set a selection — the route wins), and publishes every choice
 * to {@link QueueSelectionService}, which is what drives the message list. Selecting a queue
 * also persists it as the authenticated user's preference, best-effort.
 */
@Component({
  selector: 'app-queue-dropdown',
  templateUrl: './queue-dropdown.component.html',
  standalone: false,
})
export class QueueDropdownComponent implements OnInit {
  queues: string[] = [];
  selectedQueue: string | null = null;
  isLoading = true;

  constructor(
    private queueService: QueueService,
    private selectionService: QueueSelectionService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // Keep the displayed selection in sync with whoever set it -- a deep link publishes
    // the route queue before this component's data arrives.
    this.selectionService.selectedQueue$.subscribe((queue) => (this.selectedQueue = queue));

    this.queueService.fetchAllQueueNames().subscribe({
      next: (queues) => {
        this.isLoading = false;
        this.queues = queues;
        this.restoreLastUsedQueue();
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.apiError(err, 'Failed to load queues');
      }
    });
  }

  onQueueSelect(queue: string) {
    this.selectedQueue = queue;
    this.selectionService.setSelectedQueue(queue);
    // Best-effort: losing the preference is not worth interrupting the user over,
    // but it should not fail silently either.
    this.queueService.saveLastUsedQueue(queue).subscribe({
      error: () => this.toast.warning('Could not save your queue preference')
    });
  }

  private restoreLastUsedQueue() {
    this.queueService.getLastUsedQueue().subscribe({
      // No preference yet arrives as an empty 200, not an error, so the empty case is
      // handled here and silently — it is the normal first run.
      next: (queueName) => {
        // A selection that already exists came from the route (deep link, or returning
        // from the detail view) and must win over the stored preference — restoring it
        // over the route queue silently showed the wrong queue's messages.
        if (this.selectionService.getSelectedQueue()) return;
        if (queueName && this.queues.includes(queueName)) {
          this.selectionService.setSelectedQueue(queueName);
        }
      },
      // Reaching here means the lookup itself failed. Not worth blocking on, but it is
      // a real fault and must not pass unmentioned.
      error: () => this.toast.warning('Could not restore your last-used queue')
    });
  }
}
