import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { MessageDetailComponent } from './message-detail.component';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal.component';
import { MessageService } from '../../services/message.service';
import { ToastService } from '../../services/toast.service';
import { JmsMessage } from '../../shared/models/jms-message.model';
import { ApiResponse } from '../../shared/models/api-response.model';

const QUEUE = 'DLQ';
const MESSAGE_ID = 'ID:abc-123';

const aMessage: JmsMessage = {
  messageId: MESSAGE_ID,
  payload: '{"order":1}',
  timestamp: '2026-07-21T10:00:00Z',
  properties: {}
};

const ok: ApiResponse = { success: true, message: 'Done.' };
const failed: ApiResponse = { success: false, message: 'Broker refused the operation.' };

describe('MessageDetailComponent', () => {
  let component: MessageDetailComponent;
  let fixture: ComponentFixture<MessageDetailComponent>;
  let messageService: jasmine.SpyObj<MessageService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    messageService = jasmine.createSpyObj<MessageService>('MessageService', [
      'getMessage', 'resendMessage', 'deleteMessage', 'moveToDLQ'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', [
      'success', 'error', 'info', 'warning', 'apiError'
    ]);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    messageService.getMessage.and.returnValue(of(aMessage));

    TestBed.configureTestingModule({
      declarations: [MessageDetailComponent, ConfirmationModalComponent],
      providers: [
        { provide: MessageService, useValue: messageService },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['queueName', QUEUE], ['messageId', MESSAGE_ID]])
            }
          }
        }
      ]
    });

    fixture = TestBed.createComponent(MessageDetailComponent);
    component = fixture.componentInstance;
  });

  describe('loading the message', () => {
    it('loads the message named by the route', () => {
      fixture.detectChanges();

      expect(messageService.getMessage).toHaveBeenCalledWith(QUEUE, MESSAGE_ID);
      expect(component.message).toEqual(aMessage);
      expect(component.queueName).toBe(QUEUE);
    });

    // The API answers "no such message" with 200 and an empty body rather than 404,
    // so absence arrives through the success path.
    it('treats an empty 200 body as a missing message', () => {
      messageService.getMessage.and.returnValue(of(null as unknown as JmsMessage));

      fixture.detectChanges();

      expect(component.message).toBeNull();
      expect(toast.error).toHaveBeenCalledWith('Message not found');
      expect(router.navigate).toHaveBeenCalledWith(['/messages', QUEUE]);
    });

    it('reports a failed load without navigating away', () => {
      messageService.getMessage.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 502 }))
      );

      fixture.detectChanges();

      expect(toast.apiError).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('resend', () => {
    beforeEach(() => fixture.detectChanges());

    it('reports success and clears the spinner', () => {
      messageService.resendMessage.and.returnValue(of(ok));

      component.onResend();

      expect(messageService.resendMessage).toHaveBeenCalledWith(QUEUE, MESSAGE_ID);
      expect(toast.success).toHaveBeenCalledWith('Message resent');
      expect(component.loading.resend).toBeFalse();
    });

    // The operation failing is reported in the body with HTTP 200, so the success
    // callback runs; success must not be inferred from the callback firing.
    it('reports a body-level failure as an error, using the server message', () => {
      messageService.resendMessage.and.returnValue(of(failed));

      component.onResend();

      expect(toast.error).toHaveBeenCalledWith(failed.message);
      expect(toast.success).not.toHaveBeenCalled();
      expect(component.loading.resend).toBeFalse();
    });

    it('clears the spinner when the call errors', () => {
      messageService.resendMessage.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );

      component.onResend();

      expect(toast.apiError).toHaveBeenCalled();
      expect(component.loading.resend).toBeFalse();
    });
  });

  describe('delete', () => {
    beforeEach(() => fixture.detectChanges());

    it('asks for confirmation before deleting anything', () => {
      component.showDeleteConfirm();

      expect(component.confirm.visible).toBeTrue();
      expect(messageService.deleteMessage).not.toHaveBeenCalled();
    });

    it('deletes and returns to the list once confirmed', () => {
      messageService.deleteMessage.and.returnValue(of(ok));

      component.showDeleteConfirm();
      component.confirm.handler!();

      expect(messageService.deleteMessage).toHaveBeenCalledWith(QUEUE, MESSAGE_ID);
      expect(component.confirm.visible).toBeFalse();
      expect(toast.success).toHaveBeenCalledWith('Message deleted');
      expect(router.navigate).toHaveBeenCalledWith(['/messages', QUEUE]);
    });

    it('stays on the page when the delete fails in the body', () => {
      messageService.deleteMessage.and.returnValue(of(failed));

      component.onDeleteConfirmed();

      expect(toast.error).toHaveBeenCalledWith(failed.message);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.loading.delete).toBeFalse();
    });
  });

  describe('move to DLQ', () => {
    beforeEach(() => fixture.detectChanges());

    it('asks for confirmation before moving anything', () => {
      component.showDLQConfirm();

      expect(component.confirm.visible).toBeTrue();
      expect(messageService.moveToDLQ).not.toHaveBeenCalled();
    });

    it('moves and returns to the list once confirmed', () => {
      messageService.moveToDLQ.and.returnValue(of(ok));

      component.showDLQConfirm();
      component.confirm.handler!();

      expect(messageService.moveToDLQ).toHaveBeenCalledWith(QUEUE, MESSAGE_ID);
      expect(toast.success).toHaveBeenCalledWith('Message moved to DLQ');
      expect(router.navigate).toHaveBeenCalledWith(['/messages', QUEUE]);
    });

    it('stays on the page when the move fails in the body', () => {
      messageService.moveToDLQ.and.returnValue(of(failed));

      component.onDLQConfirmed();

      expect(toast.error).toHaveBeenCalledWith(failed.message);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.loading.dlq).toBeFalse();
    });
  });

  describe('destructive buttons', () => {
    // Regression guard: these buttons previously called onDeleteConfirmed/onDLQConfirmed
    // directly, so the modal never opened and neither action was ever confirmed.
    it('route delete and DLQ through the confirmation modal', () => {
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] =
        Array.from(fixture.nativeElement.querySelectorAll('button'));
      const byText = (label: string) =>
        buttons.find((b) => b.textContent?.trim().startsWith(label))!;

      byText('Delete').click();
      expect(component.confirm.visible).toBeTrue();
      expect(messageService.deleteMessage).not.toHaveBeenCalled();

      component.confirm.visible = false;

      byText('Move to DLQ').click();
      expect(component.confirm.visible).toBeTrue();
      expect(messageService.moveToDLQ).not.toHaveBeenCalled();
    });
  });
});
