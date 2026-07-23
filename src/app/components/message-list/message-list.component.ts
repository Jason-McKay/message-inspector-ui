import {Component, OnInit} from '@angular/core';
import { MessageService } from 'src/app/services/message.service';
import { ActivatedRoute, Router } from '@angular/router';
import {ToastService} from "../../services/toast.service";
import {QueueSelectionService} from "../../services/queue-selection.service";
import {JmsMessage} from "../../shared/models/jms-message.model";

@Component({
  selector: 'app-message-list',
  templateUrl: './message-list.component.html',
  styleUrls: ['./message-list.component.scss'],
})
export class MessageListComponent implements OnInit{
  queueName: string = '';
  messages: JmsMessage[] = [];
  selectedQueue: string | null = null;
  hasFetched: boolean = false;
  isLoading: boolean = false;
  loadError: string = '';

  constructor(private selectionService: QueueSelectionService, private messageService: MessageService, private route: ActivatedRoute, private router: Router, private toast: ToastService) {}

  ngOnInit(): void {
    this.selectionService.selectedQueue$.subscribe((queue) => {
      this.selectedQueue = queue;
      if (queue) {
        this.queueName = queue;
        this.fetchMessages();
      }
    });

    // Deep link: /messages/:queueName pre-loads that queue. This is the path taken when
    // returning here from the detail view. Published as the shared selection -- not
    // fetched directly -- so the dropdown displays it and the last-used-queue restore
    // sees it and stands down. Fetching here directly is how the route queue silently
    // lost to the restored preference (found 2026-07-23, Phase 5 manual pass).
    const routeQueue = this.route.snapshot.paramMap.get('queueName');
    if (routeQueue) {
      this.selectionService.setSelectedQueue(routeQueue);
    }
  }

  fetchMessages() {
    if (!this.queueName) return;

    this.isLoading = true;
    this.loadError = '';
    this.messageService.getMessages(this.queueName).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.hasFetched = true;
        this.isLoading = false;
      },
      error: (err) => {
        // Inline rather than a toast: a vanishing toast over a silently-stale table left
        // no persistent sign the load failed. Mutations below keep their toasts.
        this.loadError = this.toast.describeApiError(err, 'Failed to fetch messages');
        this.isLoading = false;
      },
    });
  }

  viewMessage(id: string) {
    // Pass the id raw: the Router encodes path segments itself. Pre-encoding here made
    // the id arrive at MessageDetailComponent still encoded, which the service then
    // encoded a second time -- Tomcat rejects the resulting %253A with a 400.
    this.router.navigate(['/messages', this.queueName, id]);
  }
  viewQueues() {
    this.router.navigate(['/queues']);
  }

  // Same confirmation shape as MessageDetailComponent. Both destructive actions are
  // reachable from this table too, and were firing straight at the service from the
  // template with nothing in between.
  confirm = {
    visible: false,
    action: '',
    handler: null as (() => void) | null
  };

  showDeleteConfirm(id: string) {
    this.confirm = {
      visible: true,
      action: 'Delete this message?',
      handler: () => {
        this.confirm.visible = false;
        this.deleteMessage(id);
      }
    };
  }

  showDLQConfirm(id: string) {
    this.confirm = {
      visible: true,
      action: 'Move message to DLQ?',
      handler: () => {
        this.confirm.visible = false;
        this.moveToDLQ(id);
      }
    };
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
