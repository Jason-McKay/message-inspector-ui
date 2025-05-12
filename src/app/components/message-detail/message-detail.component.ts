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
      next: (msg) => (this.message = msg),
      error: (err) => {
        if (err.status === 404) {
          this.toast.error('Message not found');
          this.router.navigate(['/messages', this.queueName]);
        } else {
          this.toast.error('Failed to fetch message');
        }
      }
    });
  }

  onResend() {
    if (!this.message) return;
    this.loading.resend = true;
    this.messageService.resendMessage(this.queueName, this.message.messageId).subscribe({
      next: () => {
        this.toast.success('Message resent');
        this.loading.resend = false;
      },
      error: () => {
        this.toast.error('Failed to resend');
        this.loading.resend = false;
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
      next: () => {
        this.toast.success('Message deleted');
        this.router.navigate(['/messages', this.queueName]);
      },
      error: () => {
        this.toast.error('Failed to delete');
        this.loading.delete = false;
      }
    });
  }

  onDLQConfirmed() {
    if (!this.message) return;
    this.loading.dlq = true;
    this.messageService.moveToDLQ(this.queueName, this.message.messageId).subscribe({
      next: () => {
        this.toast.success('Message moved to DLQ');
        this.router.navigate(['/messages', this.queueName]);
      },
      error: (err) => {
        this.toast.error('Failed to move to DLQ');
        this.loading.dlq = false;
      }
    });
  }

  goBack() {
    this.router.navigate(['/messages', this.queueName]);
  }
}
