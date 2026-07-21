import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { MessageListComponent } from './message-list.component';
import { MessageService } from '../../services/message.service';
import { ToastService } from '../../services/toast.service';
import { QueueSelectionService } from '../../services/queue-selection.service';
import { JmsMessage } from '../../shared/models/jms-message.model';
import { ApiResponse } from '../../shared/models/api-response.model';

const QUEUE = 'orders.queue';

const message = (id: string): JmsMessage => ({
  messageId: id,
  payload: '{}',
  timestamp: '2026-07-21T10:00:00Z',
  properties: {}
});

const ok: ApiResponse = { success: true, message: 'Done.' };
const failed: ApiResponse = { success: false, message: 'Message not found.' };

describe('MessageListComponent', () => {
  let component: MessageListComponent;
  let fixture: ComponentFixture<MessageListComponent>;
  let messageService: jasmine.SpyObj<MessageService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: jasmine.SpyObj<Router>;
  let selection: QueueSelectionService;
  let routeParams: Map<string, string>;

  beforeEach(() => {
    messageService = jasmine.createSpyObj<MessageService>('MessageService', [
      'getMessages', 'getMessage', 'resendMessage', 'deleteMessage', 'moveToDLQ'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', [
      'success', 'error', 'info', 'warning', 'apiError'
    ]);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    messageService.getMessages.and.returnValue(of([]));
    routeParams = new Map<string, string>();

    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [MessageListComponent],
      providers: [
        { provide: MessageService, useValue: messageService },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: routeParams } } }
      ]
    });

    fixture = TestBed.createComponent(MessageListComponent);
    component = fixture.componentInstance;
    selection = TestBed.inject(QueueSelectionService);
  });

  describe('reacting to the selected queue', () => {
    it('does not fetch while no queue is selected', () => {
      fixture.detectChanges();

      expect(messageService.getMessages).not.toHaveBeenCalled();
      expect(component.hasFetched).toBeFalse();
    });

    it('fetches whenever the shared selection changes', () => {
      messageService.getMessages.and.returnValue(of([message('a')]));
      fixture.detectChanges();

      selection.setSelectedQueue(QUEUE);

      expect(messageService.getMessages).toHaveBeenCalledWith(QUEUE);
      expect(component.queueName).toBe(QUEUE);
      expect(component.messages.length).toBe(1);
      expect(component.hasFetched).toBeTrue();
      expect(component.isLoading).toBeFalse();
    });

    // /messages/:queueName is what MessageDetailComponent navigates back to after a
    // delete or DLQ move, and what "Back to List" uses.
    it('pre-loads the queue named in the route', () => {
      routeParams.set('queueName', QUEUE);
      messageService.getMessages.and.returnValue(of([message('a')]));

      fixture.detectChanges();

      expect(messageService.getMessages).toHaveBeenCalledWith(QUEUE);
      expect(component.queueName).toBe(QUEUE);
      expect(component.messages.length).toBe(1);
    });

    it('reports a failed fetch and stops loading', () => {
      messageService.getMessages.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 502 }))
      );
      fixture.detectChanges();

      selection.setSelectedQueue(QUEUE);

      expect(toast.apiError).toHaveBeenCalled();
      expect(component.isLoading).toBeFalse();
      expect(component.hasFetched).toBeFalse();
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      messageService.getMessages.and.returnValue(of([message('a'), message('b')]));
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
    });

    it('removes the row once the server confirms', () => {
      messageService.deleteMessage.and.returnValue(of(ok));

      component.deleteMessage('a');

      expect(messageService.deleteMessage).toHaveBeenCalledWith(QUEUE, 'a');
      expect(component.messages.map((m) => m.messageId)).toEqual(['b']);
      expect(toast.success).toHaveBeenCalledWith('Message deleted');
    });

    // Previously the row was filtered out unconditionally, so a failed delete
    // still looked like it had worked.
    it('keeps the row when the body reports failure', () => {
      messageService.deleteMessage.and.returnValue(of(failed));

      component.deleteMessage('a');

      expect(component.messages.map((m) => m.messageId)).toEqual(['a', 'b']);
      expect(toast.error).toHaveBeenCalledWith(failed.message);
    });

    it('keeps the row and reports when the call errors', () => {
      messageService.deleteMessage.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 400 }))
      );

      component.deleteMessage('a');

      expect(component.messages.map((m) => m.messageId)).toEqual(['a', 'b']);
      expect(toast.apiError).toHaveBeenCalled();
    });
  });

  describe('move to DLQ', () => {
    beforeEach(() => {
      messageService.getMessages.and.returnValue(of([message('a'), message('b')]));
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
    });

    it('removes the row once the server confirms', () => {
      messageService.moveToDLQ.and.returnValue(of(ok));

      component.moveToDLQ('b');

      expect(messageService.moveToDLQ).toHaveBeenCalledWith(QUEUE, 'b');
      expect(component.messages.map((m) => m.messageId)).toEqual(['a']);
      expect(toast.success).toHaveBeenCalledWith('Message moved to DLQ');
    });

    it('keeps the row when the body reports failure', () => {
      messageService.moveToDLQ.and.returnValue(of(failed));

      component.moveToDLQ('b');

      expect(component.messages.map((m) => m.messageId)).toEqual(['a', 'b']);
      expect(toast.error).toHaveBeenCalledWith(failed.message);
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
    });

    // The id must reach the Router raw. The Router encodes the segment, ActivatedRoute
    // decodes it, and MessageService encodes it once more for the HTTP call — one encode
    // per boundary. Pre-encoding here produced %253A in the request URL, which Tomcat
    // rejects with a 400 before Spring sees it.
    it('passes the message id to the router unencoded', () => {
      component.viewMessage('ID:a b');

      expect(router.navigate).toHaveBeenCalledWith(['/messages', QUEUE, 'ID:a b']);
    });

    it('navigates to the queue list', () => {
      component.viewQueues();

      expect(router.navigate).toHaveBeenCalledWith(['/queues']);
    });
  });
});
