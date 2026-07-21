import {Component, OnInit} from '@angular/core';
import { MessageService } from 'src/app/services/message.service';
import { Router } from '@angular/router';
import {ToastService} from "../../services/toast.service";
import {QueueSelectionService} from "../../services/queue-selection.service";

@Component({
  selector: 'app-message-list',
  templateUrl: './message-list.component.html',
  styleUrls: ['./message-list.component.scss'],
})
export class MessageListComponent implements OnInit{
  queueName: string = '';
  messages: any[] = [];
  selectedQueue: string | null = null;
  hasFetched: boolean = false;
  isLoading: boolean = false;

  constructor(private selectionService: QueueSelectionService, private messageService: MessageService, private router: Router, private toast: ToastService) {}

  ngOnInit(): void {
    this.selectionService.selectedQueue$.subscribe((queue) => {
      this.selectedQueue = queue;
      if (queue) {
        this.queueName = queue;
        this.fetchMessages();
      }
    });
  }

  fetchMessages() {
    if (!this.queueName) return;

    this.isLoading = true;
    this.messageService.getMessages(this.queueName).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.hasFetched = true;
        this.isLoading = false;
      },
      error: (err) => {
        this.toast.apiError(err, 'Failed to fetch messages');
        this.isLoading = false;
      },
    });
  }

  viewMessage(id: string) {
    const encodedId = encodeURIComponent(id);
    this.router.navigate(['/messages', this.queueName, encodedId]);
  }
  viewQueues() {
    this.router.navigate(['/queues']);
  }

  deleteMessage(id: string) {
    this.messageService.deleteMessage(this.queueName, id).subscribe({
      next: (res) => {
        if (!res.success) {
          this.toast.error(res.message || 'Failed to delete');
          return;
        }
        this.toast.success('Message deleted');
        this.removeFromList(id);
      },
      error: (err) => this.toast.apiError(err, 'Failed to delete'),
    });
  }

  moveToDLQ(id: string) {
    this.messageService.moveToDLQ(this.queueName, id).subscribe({
      next: (res) => {
        if (!res.success) {
          this.toast.error(res.message || 'Failed to move to DLQ');
          return;
        }
        this.toast.success('Message moved to DLQ');
        this.removeFromList(id);
      },
      error: (err) => this.toast.apiError(err, 'Failed to move to DLQ'),
    });
  }

  private removeFromList(id: string) {
    this.messages = this.messages.filter((m) => m.messageId !== id);
  }
}
