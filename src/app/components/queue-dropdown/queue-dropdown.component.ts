import { Component, OnInit } from '@angular/core';
import {QueueService} from "../../services/queue.service";
import {QueueSelectionService} from "../../services/queue-selection.service";
import {ToastService} from "../../services/toast.service";


@Component({
  selector: 'app-queue-dropdown',
  templateUrl: './queue-dropdown.component.html',
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
    this.queueService.fetchAllQueueNames().subscribe({
      next: (response) => {
        this.isLoading = false;
        this.queues = response.value ?? [];
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
        if (queueName && this.queues.includes(queueName)) {
          this.selectedQueue = queueName;
          this.selectionService.setSelectedQueue(queueName);
        }
      },
      // Reaching here means the lookup itself failed. Not worth blocking on, but it is
      // a real fault and must not pass unmentioned.
      error: () => this.toast.warning('Could not restore your last-used queue')
    });
  }
}
