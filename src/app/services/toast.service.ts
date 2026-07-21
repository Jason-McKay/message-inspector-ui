import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private toastr: ToastrService) {}

  /**
   * Show a failed HTTP call. The API reports errors as
   * `{"success":false,"message":"..."}` with a truthful status: 400 for a rejected
   * message ID, 502 when the broker is unavailable, 500 otherwise. Prefer the server's
   * own message; fall back to something status-appropriate when it is absent.
   */
  apiError(err: unknown, fallback: string) {
    this.error(this.describeApiError(err, fallback));
  }

  /**
   * The same mapping as {@link apiError}, but returned rather than shown. For views that
   * render failures inline instead of as a toast — QueueListComponent fires three calls
   * at once, and three simultaneous toasts would be worse than three inline messages.
   */
  describeApiError(err: unknown, fallback: string): string {
    if (!(err instanceof HttpErrorResponse)) {
      return fallback;
    }
    const serverMessage = err.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }
    switch (err.status) {
      case 0:
        return 'Cannot reach the server';
      case 400:
        return 'The server rejected the request';
      case 502:
        return 'The message broker is unavailable';
      default:
        return fallback;
    }
  }

  success(message: string, title?: string) {
    this.toastr.success(message, title);
  }

  error(message: string, title?: string) {
    this.toastr.error(message, title);
  }

  info(message: string, title?: string) {
    this.toastr.info(message, title);
  }

  warning(message: string, title?: string) {
    this.toastr.warning(message, title);
  }
}
