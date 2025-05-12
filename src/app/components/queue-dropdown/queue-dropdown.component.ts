import { Component, OnInit } from '@angular/core';
import {QueueService} from "../../services/queue.service";
import {QueueSelectionService} from "../../services/queue-selection.service";


@Component({
  selector: 'app-queue-dropdown',
  templateUrl: './queue-dropdown.component.html',
})
export class QueueDropdownComponent implements OnInit {
  queues: string[] = [];
  selectedQueue: string | null = null;
  readonly userId = 'jason';

  constructor(
    private queueService: QueueService,
    private selectionService: QueueSelectionService
  ) {}

  ngOnInit(): void {
    this.queueService.fetchAllQueueNames().subscribe((response) => {
      this.queues = response.value;
      // Fetch the last-used queue from Redis
      this.queueService.getLastUsedQueue(this.userId).subscribe((queueName) => {
        if (queueName && this.queues.includes(queueName)) {
          this.selectedQueue = queueName;
          this.selectionService.setSelectedQueue(queueName);
        }
      });
    });
  }

  onQueueSelect(queue: string) {
    this.selectedQueue = queue;
    this.selectionService.setSelectedQueue(queue);
    this.queueService.saveLastUsedQueue(this.userId, queue).subscribe();
    //localStorage.setItem('lastUsedQueue', queue);
  }
}
