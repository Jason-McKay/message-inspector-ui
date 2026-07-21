import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { QueueDropdownComponent } from './queue-dropdown.component';
import { QueueService, JolokiaResponse } from '../../services/queue.service';
import { QueueSelectionService } from '../../services/queue-selection.service';
import { ToastService } from '../../services/toast.service';

const QUEUES = ['DLQ', 'orders.queue'];

const jolokia = (value: string[]): JolokiaResponse<string[]> => ({
  request: { type: 'read' },
  value,
  timestamp: 0,
  status: 200
});

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

    queueService.fetchAllQueueNames.and.returnValue(of(jolokia(QUEUES)));
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
    // The Jolokia endpoints wrap their payload in a JMX envelope; the names are in
    // `value`, not the response body itself.
    it('reads the names out of the Jolokia envelope', () => {
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
      expect(queueService.getLastUsedQueue).not.toHaveBeenCalled();
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

    // No stored preference is the normal first-run case and must not raise a toast.
    it('stays quiet when no preference can be read', () => {
      queueService.getLastUsedQueue.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 404 }))
      );

      fixture.detectChanges();

      expect(component.selectedQueue).toBeNull();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.apiError).not.toHaveBeenCalled();
    });
  });

  describe('selecting a queue', () => {
    beforeEach(() => fixture.detectChanges());

    it('publishes the selection and persists it', () => {
      component.onQueueSelect('DLQ');

      expect(component.selectedQueue).toBe('DLQ');
      expect(selection.getSelectedQueue()).toBe('DLQ');
      expect(queueService.saveLastUsedQueue).toHaveBeenCalledWith(component.userId, 'DLQ');
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
