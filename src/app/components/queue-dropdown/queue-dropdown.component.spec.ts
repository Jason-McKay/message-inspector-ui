import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';

import { QueueDropdownComponent } from './queue-dropdown.component';
import { QueueService } from '../../services/queue.service';
import { QueueSelectionService } from '../../services/queue-selection.service';
import { ToastService } from '../../services/toast.service';

const QUEUES = ['DLQ', 'orders.queue'];

describe('QueueDropdownComponent', () => {
  let component: QueueDropdownComponent;
  let fixture: ComponentFixture<QueueDropdownComponent>;
  let queueService: jasmine.SpyObj<QueueService>;
  let toast: jasmine.SpyObj<ToastService>;
  let selection: QueueSelectionService;

  beforeEach(() => {
    queueService = jasmine.createSpyObj<QueueService>('QueueService', [
      'getAllQueues', 'fetchAllQueues', 'fetchAllQueueNames',
      'getLastUsedQueue', 'saveLastUsedQueue'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', [
      'success', 'error', 'info', 'warning', 'apiError'
    ]);

    queueService.fetchAllQueueNames.and.returnValue(of(QUEUES));
    queueService.getLastUsedQueue.and.returnValue(of(''));
    queueService.saveLastUsedQueue.and.returnValue(of(void 0));

    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [QueueDropdownComponent],
      providers: [
        { provide: QueueService, useValue: queueService },
        { provide: ToastService, useValue: toast }
      ]
    });

    fixture = TestBed.createComponent(QueueDropdownComponent);
    component = fixture.componentInstance;
    selection = TestBed.inject(QueueSelectionService);
  });

  describe('loading queue names', () => {
    // The envelope-vs-bare-array question lives in QueueService now (see
    // queue.service.spec.ts); this component just receives plain names.
    it('loads the queue names', () => {
      fixture.detectChanges();

      expect(component.queues).toEqual(QUEUES);
    });

    it('reports a failure to load queues', () => {
      queueService.fetchAllQueueNames.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 502 }))
      );

      fixture.detectChanges();

      expect(toast.apiError).toHaveBeenCalled();
      expect(component.queues).toEqual([]);
      expect(component.isLoading).toBeFalse();
      expect(queueService.getLastUsedQueue).not.toHaveBeenCalled();
    });

    // NgModel applies a [disabled] binding in a microtask, hence fakeAsync/tick.
    it('disables the select with a placeholder while loading', fakeAsync(() => {
      const pending = new Subject<string[]>();
      queueService.fetchAllQueueNames.and.returnValue(pending.asObservable());

      fixture.detectChanges();
      tick();

      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      expect(select.disabled).toBeTrue();
      expect(select.textContent).toContain('Loading queues…');

      pending.next(QUEUES);
      pending.complete();
      fixture.detectChanges();
      tick();

      expect(select.disabled).toBeFalse();
      expect(select.textContent).not.toContain('Loading queues…');
    }));

    it('notes when the broker has no queues at all', () => {
      queueService.fetchAllQueueNames.and.returnValue(of([]));

      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No queues available');
    });
  });

  describe('restoring the last-used queue', () => {
    it('selects it and publishes it to the shared selection', () => {
      queueService.getLastUsedQueue.and.returnValue(of('orders.queue'));

      fixture.detectChanges();

      expect(component.selectedQueue).toBe('orders.queue');
      expect(selection.getSelectedQueue()).toBe('orders.queue');
    });

    // The stored preference can name a queue that no longer exists on the broker.
    it('ignores a stored queue that is not on the broker', () => {
      queueService.getLastUsedQueue.and.returnValue(of('deleted.queue'));

      fixture.detectChanges();

      expect(component.selectedQueue).toBeNull();
      expect(selection.getSelectedQueue()).toBeNull();
    });

    // A user with no stored preference gets 200 with an empty body, not a 404
    // (QueueControllerTest.testGetLastUsedQueue_NoPreferenceReturnsOkWithEmptyBody).
    // This is the normal first run and must not raise anything.
    it('stays quiet on the empty body that means "no preference yet"', () => {
      queueService.getLastUsedQueue.and.returnValue(of(''));

      fixture.detectChanges();

      expect(component.selectedQueue).toBeNull();
      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.apiError).not.toHaveBeenCalled();
    });

    // Since absence is not an error, an error here is a genuine fault (Redis down,
    // say) and should be surfaced rather than swallowed.
    it('warns when the lookup itself fails, without blocking the dropdown', () => {
      queueService.getLastUsedQueue.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );

      fixture.detectChanges();

      expect(toast.warning).toHaveBeenCalled();
      expect(component.queues).toEqual(QUEUES);
      expect(component.selectedQueue).toBeNull();
    });
  });

  describe('selecting a queue', () => {
    beforeEach(() => fixture.detectChanges());

    it('publishes the selection and persists it', () => {
      component.onQueueSelect('DLQ');

      expect(component.selectedQueue).toBe('DLQ');
      expect(selection.getSelectedQueue()).toBe('DLQ');
      // No user id: the backend derives the user from the token, so the call is just the
      // queue name.
      expect(queueService.saveLastUsedQueue).toHaveBeenCalledWith('DLQ');
    });

    // Persisting the preference is best-effort: the selection must still take effect.
    it('keeps the selection when persisting it fails', () => {
      queueService.saveLastUsedQueue.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 }))
      );

      component.onQueueSelect('DLQ');

      expect(selection.getSelectedQueue()).toBe('DLQ');
      expect(toast.warning).toHaveBeenCalled();
    });
  });
});
