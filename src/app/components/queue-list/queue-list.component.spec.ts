import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of, Subject, throwError } from 'rxjs';

import { QueueListComponent } from './queue-list.component';
import { QueueService, JmsQueueDto } from '../../services/queue.service';
import { ToastService } from '../../services/toast.service';

const queue = (id: string, name: string): JmsQueueDto => ({
  queueId: id,
  queueName: name,
  messageCount: 3
});

const failure = (status: number, message?: string) =>
  throwError(() => new HttpErrorResponse({
    status,
    error: message ? { success: false, message } : null
  }));

describe('QueueListComponent', () => {
  let component: QueueListComponent;
  let fixture: ComponentFixture<QueueListComponent>;
  let queueService: jasmine.SpyObj<QueueService>;

  beforeEach(() => {
    queueService = jasmine.createSpyObj<QueueService>('QueueService', [
      'getAllQueues', 'fetchAllQueues', 'fetchAllQueueNames',
      'getLastUsedQueue', 'saveLastUsedQueue'
    ]);

    queueService.getAllQueues.and.returnValue(of([]));
    queueService.fetchAllQueues.and.returnValue(of([]));
    queueService.fetchAllQueueNames.and.returnValue(of([]));

    TestBed.configureTestingModule({
      declarations: [QueueListComponent],
      providers: [
        { provide: QueueService, useValue: queueService },
        // The real ToastService, for its status mapping; only its ToastrService
        // dependency is stubbed. This view renders failures inline, not as toasts.
        ToastService,
        {
          provide: ToastrService,
          useValue: jasmine.createSpyObj('ToastrService', ['success', 'error', 'info', 'warning'])
        }
      ]
    });
  });

  const build = () => {
    fixture = TestBed.createComponent(QueueListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('loads all three queue sources on init', () => {
    queueService.getAllQueues.and.returnValue(of([queue('1', 'DLQ')]));
    queueService.fetchAllQueues.and.returnValue(of([queue('2', 'testQueue')]));
    queueService.fetchAllQueueNames.and.returnValue(of(['DLQ', 'testQueue']));

    build();

    expect(component.queuesArtemis.length).toBe(1);
    expect(component.queuesJolokia.length).toBe(1);
    expect(component.queueNamesJolokia).toEqual(['DLQ', 'testQueue']);
    expect(component.loading).toBeFalse();
    expect(component.loading2).toBeFalse();
    expect(component.loading3).toBeFalse();
  });

  describe('failures', () => {
    // Each source used to console.error and show a hardcoded string, discarding the
    // server's own message. The backend now sends a truthful status and body.
    it('surfaces the server message for the Artemis source', () => {
      queueService.getAllQueues.and.returnValue(failure(502, 'Broker unavailable.'));

      build();

      expect(component.error).toBe('Broker unavailable.');
      expect(component.loading).toBeFalse();
    });

    it('falls back to a status-appropriate message when the body carries none', () => {
      queueService.fetchAllQueues.and.returnValue(failure(502));

      build();

      expect(component.error2).toBe('The message broker is unavailable');
      expect(component.loading2).toBeFalse();
    });

    // The three calls are independent; one failing must not blank the others.
    it('keeps the other two sources when one fails', () => {
      queueService.getAllQueues.and.returnValue(failure(500));
      queueService.fetchAllQueues.and.returnValue(of([queue('2', 'testQueue')]));
      queueService.fetchAllQueueNames.and.returnValue(of(['DLQ']));

      build();

      expect(component.error).toBe('Failed to load Artemis queues');
      expect(component.queuesJolokia.length).toBe(1);
      expect(component.queueNamesJolokia).toEqual(['DLQ']);
      expect(component.error2).toBe('');
      expect(component.error3).toBe('');
    });

    it('renders failures as inline alerts', () => {
      queueService.getAllQueues.and.returnValue(failure(502, 'Broker unavailable.'));

      build();

      const alert = fixture.nativeElement.querySelector('.alert-danger');
      expect(alert?.textContent).toContain('Broker unavailable.');
    });
  });

  describe('rendered states', () => {
    // Two of the three sources return [] unconditionally (known gap, deliberately
    // deferred); the empty state makes that honest instead of invisible.
    it('shows an empty state per source instead of a blank area', () => {
      build();

      const empties = fixture.nativeElement.querySelectorAll('.alert-info');
      expect(empties.length).toBe(3);
    });

    it('shows a spinner for a source while its fetch is pending', () => {
      const pending = new Subject<JmsQueueDto[]>();
      queueService.getAllQueues.and.returnValue(pending.asObservable());

      build();

      expect(fixture.nativeElement.querySelector('.spinner-border')).toBeTruthy();

      pending.next([queue('1', 'DLQ')]);
      pending.complete();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.spinner-border')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
    });
  });
});
