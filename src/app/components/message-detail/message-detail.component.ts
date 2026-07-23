import {Component, Input, OnInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from '../../services/message.service';
import { ToastService } from '../../services/toast.service';
import {JmsMessage} from "../../shared/models/jms-message.model";

/**
 * One message in full: its properties and its payload (pretty-printed by the
 * `prettyPayload` pipe — JSON re-indented, XML indented, anything else left raw), plus the
 * resend / delete / move-to-DLQ actions, each behind {@link ConfirmationModalComponent}.
 * A missing message arrives as an empty 200 (not a 404) and is treated as "not found"; a
 * failed load renders an inline error with a Back button rather than a blank page.
 */
@Component({
  selector: 'app-message-detail',
  templateUrl: './message-detail.component.html',
  styleUrls: ['./message-detail.component.scss'],
})
export class MessageDetailComponent implements OnInit {
  message: JmsMessage | null = null;
  @Input()queueName = '';
  loading = { resend: false, delete: false, dlq: false };
  isLoading = true;
  loadError: string | null = null;

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
        this.isLoading = false;
        // A message that is not on the queue comes back as 200 with an empty body,
        // not 404, so absence has to be detected here rather than in the error branch.
        if (!msg || !msg.messageId) {
          this.toast.error('Message not found');
          this.router.navigate(['/messages', this.queueName]);
          return;
        }
        this.message = msg;
      },
      error: (err) => {
        // Inline rather than a toast: before this, a failed load left a blank page.
        this.isLoading = false;
        this.loadError = this.toast.describeApiError(err, 'Failed to fetch message');
      }
    });
  }

  // Resend goes through the same confirmation as delete and DLQ: it writes a new
  // message onto the queue, which is not obviously reversible either.
  showResendConfirm() {
    this.confirm = {
      visible: true,
      action: 'Resend this message?',
      handler: () => {
        this.confirm.visible = false;
        this.onResend();
      }
    };
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
