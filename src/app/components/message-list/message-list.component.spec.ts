import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { MessageListComponent } from './message-list.component';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal.component';
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
      'success', 'error', 'info', 'warning', 'apiError', 'describeApiError'
    ]);
    toast.describeApiError.and.returnValue('described error');
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    messageService.getMessages.and.returnValue(of([]));
    routeParams = new Map<string, string>();

    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [MessageListComponent, ConfirmationModalComponent],
      providers: [
        { provide: MessageService, useValue: messageService },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: routeParams } } }
      ],
      // <app-queue-dropdown> is now mounted in the template; it has its own spec, so ignore
      // it as an unknown element here rather than pulling its whole dependency tree in.
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
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
    // delete or DLQ move, and what "Back to List" uses. It must be PUBLISHED as the
    // shared selection, not just fetched: the dropdown's last-used restore checks the
    // selection before overriding, and a direct fetch left it null — which is how a
    // stored preference silently replaced the deep-linked queue (2026-07-23).
    it('pre-loads the queue named in the route and publishes it as the selection', () => {
      routeParams.set('queueName', QUEUE);
      messageService.getMessages.and.returnValue(of([message('a')]));

      fixture.detectChanges();

      expect(messageService.getMessages).toHaveBeenCalledWith(QUEUE);
      expect(component.queueName).toBe(QUEUE);
      expect(component.messages.length).toBe(1);
      expect(selection.getSelectedQueue()).toBe(QUEUE);
    });

    // Load failures render inline, not as a toast: a vanishing toast over a
    // silently-stale table left no persistent sign the load failed.
    it('reports a failed fetch inline and stops loading', () => {
      messageService.getMessages.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 502 }))
      );
      fixture.detectChanges();

      selection.setSelectedQueue(QUEUE);
      fixture.detectChanges();

      expect(toast.apiError).not.toHaveBeenCalled();
      expect(component.loadError).toBe('described error');
      expect(component.isLoading).toBeFalse();
      expect(component.hasFetched).toBeFalse();

      const alert = fixture.nativeElement.querySelector('.alert-danger');
      expect(alert?.textContent).toContain('described error');
    });

    it('clears a previous load error when refetching', () => {
      messageService.getMessages.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 502 }))
      );
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
      expect(component.loadError).toBe('described error');

      messageService.getMessages.and.returnValue(of([message('a')]));
      component.fetchMessages();

      expect(component.loadError).toBe('');
    });
  });

  describe('loading state', () => {
    it('shows a spinner while the fetch is pending and hides it after', () => {
      const pending = new Subject<JmsMessage[]>();
      messageService.getMessages.and.returnValue(pending.asObservable());
      fixture.detectChanges();

      selection.setSelectedQueue(QUEUE);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.spinner-border')).toBeTruthy();

      pending.next([message('a')]);
      pending.complete();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.spinner-border')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
    });

    // The empty-state alert must not flash underneath the spinner mid-fetch.
    it('hides the empty state while a fetch is in flight', () => {
      messageService.getMessages.and.returnValue(of([]));
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.alert-info')).toBeTruthy();

      const pending = new Subject<JmsMessage[]>();
      messageService.getMessages.and.returnValue(pending.asObservable());
      component.fetchMessages();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.alert-info')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('.spinner-border')).toBeTruthy();
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      messageService.getMessages.and.returnValue(of([message('a'), message('b')]));
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
    });

    // The table's Delete button previously called the service straight from the
    // template, with no confirmation between the click and a destructive call.
    it('asks for confirmation before deleting anything', () => {
      component.showDeleteConfirm('a');

      expect(component.confirm.visible).toBeTrue();
      expect(messageService.deleteMessage).not.toHaveBeenCalled();
    });

    it('deletes the row the confirmation was opened for', () => {
      messageService.deleteMessage.and.returnValue(of(ok));

      component.showDeleteConfirm('a');
      component.confirm.handler!();

      expect(messageService.deleteMessage).toHaveBeenCalledWith(QUEUE, 'a');
      expect(component.confirm.visible).toBeFalse();
      expect(component.messages.map((m) => m.messageId)).toEqual(['b']);
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

    it('asks for confirmation before moving anything', () => {
      component.showDLQConfirm('b');

      expect(component.confirm.visible).toBeTrue();
      expect(messageService.moveToDLQ).not.toHaveBeenCalled();
    });

    it('moves the row the confirmation was opened for', () => {
      messageService.moveToDLQ.and.returnValue(of(ok));

      component.showDLQConfirm('b');
      component.confirm.handler!();

      expect(messageService.moveToDLQ).toHaveBeenCalledWith(QUEUE, 'b');
      expect(component.messages.map((m) => m.messageId)).toEqual(['a']);
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

  describe('destructive buttons', () => {
    // Guards the template, not just the methods. The spec above calls
    // showDeleteConfirm() directly, so it would still pass if the button were rewired
    // straight to deleteMessage() — which is exactly how this bug existed.
    it('route delete and DLQ through the confirmation modal', () => {
      messageService.getMessages.and.returnValue(of([message('a')]));
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] =
        Array.from(fixture.nativeElement.querySelectorAll('td button'));
      const byText = (label: string) =>
        buttons.find((b) => b.textContent?.trim() === label)!;

      byText('Delete').click();
      expect(component.confirm.visible).toBeTrue();
      expect(messageService.deleteMessage).not.toHaveBeenCalled();

      component.confirm.visible = false;

      byText('Move to DLQ').click();
      expect(component.confirm.visible).toBeTrue();
      expect(messageService.moveToDLQ).not.toHaveBeenCalled();
    });

    // Guards the (cancelled) binding on <app-confirmation-modal>. An event name the modal
    // does not declare still compiles — Angular binds it as a native DOM listener — so a
    // stale binding would leave Cancel dead with every other spec green.
    it('closes the confirmation modal from its Cancel button without deleting', () => {
      messageService.getMessages.and.returnValue(of([message('a')]));
      fixture.detectChanges();
      selection.setSelectedQueue(QUEUE);
      fixture.detectChanges();

      const deleteButton: HTMLButtonElement = Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('td button')
      ).find((b) => b.textContent?.trim() === 'Delete')!;
      deleteButton.click();
      fixture.detectChanges();

      const cancel: HTMLButtonElement = Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('app-confirmation-modal button')
      ).find((b) => b.textContent?.trim() === 'Cancel')!;
      cancel.click();

      expect(component.confirm.visible).toBeFalse();
      expect(messageService.deleteMessage).not.toHaveBeenCalled();
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
