import {Component, Input, OnInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from '../../services/message.service';
import { ToastService } from '../../services/toast.service';
import {JmsMessage} from "../../shared/models/jms-message.model";

@Component({
  selector: 'app-message-detail',
  templateUrl: './message-detail.component.html',
  styleUrls: ['./message-detail.component.scss'],
})
export class MessageDetailComponent implements OnInit {
  message: JmsMessage | null = null;
  @Input()queueName = '';
  loading = { resend: false, delete: false, dlq: false };

  constructor(
    private route: ActivatedRoute,
    private messageService: MessageService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.queueName = this.route.snapshot.paramMap.get('queueName')!;
    const messageId = this.route.snapshot.paramMap.get('messageId')!;
    this.messageService.getMessage(this.queueName, messageId).subscribe({
      next: (msg) => {
        // A message that is not on the queue comes back as 200 with an empty body,
        // not 404, so absence has to be detected here rather than in the error branch.
        if (!msg || !msg.messageId) {
          this.toast.error('Message not found');
          this.router.navigate(['/messages', this.queueName]);
          return;
        }
        this.message = msg;
      },
      error: (err) => this.toast.apiError(err, 'Failed to fetch message')
    });
  }

  onResend() {
    if (!this.message) return;
    this.loading.resend = true;
    this.messageService.resendMessage(this.queueName, this.message.messageId).subscribe({
      next: (res) => {
        this.loading.resend = false;
        if (!res.success) {
          this.toast.error(res.message || 'Failed to resend');
          return;
        }
        this.toast.success('Message resent');
      },
      error: (err) => {
        this.loading.resend = false;
        this.toast.apiError(err, 'Failed to resend');
      }
    });
  }

  confirm = {
    visible: false,
    action: '',
    handler: null as (() => void) | null
  };

  showDeleteConfirm() {
    this.confirm = {
      visible: true,
      action: 'Delete this message?',
      handler: () => {
        this.confirm.visible = false;
        this.onDeleteConfirmed();
      }
    };
  }

  showDLQConfirm() {
    this.confirm = {
      visible: true,
      action: 'Move message to DLQ?',
      handler: () => {
        this.confirm.visible = false;
        this.onDLQConfirmed();
      }
    };
  }

  onDeleteConfirmed() {
    if (!this.message) return;
    this.loading.delete = true;
    this.messageService.deleteMessage(this.queueName, this.message.messageId).subscribe({
      next: (res) => {
        this.loading.delete = false;
        if (!res.success) {
          this.toast.error(res.message || 'Failed to delete');
          return;
        }
        this.toast.success('Message deleted');
        this.router.navigate(['/messages', this.queueName]);
      },
      error: (err) => {
        this.loading.delete = false;
        this.toast.apiError(err, 'Failed to delete');
      }
    });
  }

  onDLQConfirmed() {
    if (!this.message) return;
    this.loading.dlq = true;
    this.messageService.moveToDLQ(this.queueName, this.message.messageId).subscribe({
      next: (res) => {
        this.loading.dlq = false;
        if (!res.success) {
          this.toast.error(res.message || 'Failed to move to DLQ');
          return;
        }
        this.toast.success('Message moved to DLQ');
        this.router.navigate(['/messages', this.queueName]);
      },
      error: (err) => {
        this.loading.dlq = false;
        this.toast.apiError(err, 'Failed to move to DLQ');
      }
    });
  }

  goBack() {
    this.router.navigate(['/messages', this.queueName]);
  }
}
