import {Component, OnInit} from '@angular/core';
import {JmsQueueDto, JolokiaResponse, QueueService} from "../../services/queue.service";

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

  constructor(private queueService: QueueService) {}

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
        this.error = 'Failed to load Artemis queues\n';
        console.error(err);
        this.loading = false;
      }
    });

    this.queueService.fetchAllQueues().subscribe({
      next: (data) => {
        this.queuesJolokia = data;
        this.loading2 = false;
      },
      error: (err) => {
        this.error2 = 'Failed to load Jolokia queues\n';
        console.error(err);
        this.loading2 = false;
      }
    });

    this.queueService.fetchAllQueueNames().subscribe({
      next: (data) => {
        this.queueNamesJolokia = data.value;
        this.loading3 = false;
      },
      error: (err) => {
        this.error3 = 'Failed to load Jolokia queues names\n';
        console.error(err);
        this.loading3 = false;
      }
    });
  }

}
