import {Component, OnInit} from '@angular/core';
import {JmsQueueDto, QueueService} from "../../services/queue.service";
import {ToastService} from "../../services/toast.service";

/**
 * A diagnostic view of all three queue-discovery sources side by side. Two of them
 * (`artemis-straight`, `artemis-jolokia`) are dead on the backend and return `[]` — so two
 * of these tables are permanently empty by design, shown with an honest empty state rather
 * than hidden. Only the queue-names source works. The three load independently: one failing
 * does not blank the others.
 */
@Component({
  selector: 'app-queue-list',
  templateUrl: './queue-list.component.html',
  styleUrls: ['./queue-list.component.scss']
})
export class QueueListComponent implements OnInit {
  queuesArtemis: JmsQueueDto[] = [];
  queuesJolokia: JmsQueueDto[] = [];
  queueNamesJolokia: string[] = [];
  loading = false;
  error = '';
  loading2 = false;
  error2 = '';
  loading3 = false;
  error3 = '';

  constructor(private queueService: QueueService, private toast: ToastService) {}

  ngOnInit(): void {
    this.fetchQueues();
  }

  fetchQueues(): void {
    this.loading = true;
    this.loading2 = true;
    this.loading3 = true;

    this.queueService.getAllQueues().subscribe({
      next: (data) => {
        this.queuesArtemis = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = this.toast.describeApiError(err, 'Failed to load Artemis queues');
        this.loading = false;
      }
    });

    this.queueService.fetchAllQueues().subscribe({
      next: (data) => {
        this.queuesJolokia = data;
        this.loading2 = false;
      },
      error: (err) => {
        this.error2 = this.toast.describeApiError(err, 'Failed to load Jolokia queues');
        this.loading2 = false;
      }
    });

    this.queueService.fetchAllQueueNames().subscribe({
      next: (data) => {
        this.queueNamesJolokia = data;
        this.loading3 = false;
      },
      error: (err) => {
        this.error3 = this.toast.describeApiError(err, 'Failed to load Jolokia queue names');
        this.loading3 = false;
      }
    });
  }

}
