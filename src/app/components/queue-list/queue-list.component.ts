import {Component, OnInit} from '@angular/core';
import {QueueService} from "../../services/queue.service";
import {ToastService} from "../../services/toast.service";

/**
 * Lists the queues discovered on the broker. Only one discovery source survives —
 * `artemis-jolokia/names` — after the two dead sources (`artemis-straight`,
 * `artemis-jolokia`, which always returned `[]`) were deleted along with their backing
 * endpoints. Load failures render inline, not as a toast over stale content.
 */
@Component({
  selector: 'app-queue-list',
  templateUrl: './queue-list.component.html',
  styleUrls: ['./queue-list.component.scss'],
  standalone: false
})
export class QueueListComponent implements OnInit {
  queueNamesJolokia: string[] = [];
  loading = false;
  error = '';

  constructor(private queueService: QueueService, private toast: ToastService) {}

  ngOnInit(): void {
    this.fetchQueues();
  }

  fetchQueues(): void {
    this.loading = true;

    this.queueService.fetchAllQueueNames().subscribe({
      next: (data) => {
        this.queueNamesJolokia = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = this.toast.describeApiError(err, 'Failed to load queue names');
        this.loading = false;
      }
    });
  }

}
