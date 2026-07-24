import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { of, Subject, throwError } from 'rxjs';

import { QueueListComponent } from './queue-list.component';
import { QueueService } from '../../services/queue.service';
import { ToastService } from '../../services/toast.service';

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
      'fetchAllQueueNames', 'getLastUsedQueue', 'saveLastUsedQueue'
    ]);

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

  it('loads the queue names on init', () => {
    queueService.fetchAllQueueNames.and.returnValue(of(['DLQ', 'testQueue']));

    build();

    expect(component.queueNamesJolokia).toEqual(['DLQ', 'testQueue']);
    expect(component.loading).toBeFalse();
  });

  describe('failures', () => {
    // The source used to console.error and show a hardcoded string, discarding the
    // server's own message. The backend now sends a truthful status and body.
    it('surfaces the server message', () => {
      queueService.fetchAllQueueNames.and.returnValue(failure(502, 'Broker unavailable.'));

      build();

      expect(component.error).toBe('Broker unavailable.');
      expect(component.loading).toBeFalse();
    });

    it('falls back to a status-appropriate message when the body carries none', () => {
      queueService.fetchAllQueueNames.and.returnValue(failure(502));

      build();

      expect(component.error).toBe('The message broker is unavailable');
      expect(component.loading).toBeFalse();
    });

    it('renders the failure as an inline alert', () => {
      queueService.fetchAllQueueNames.and.returnValue(failure(502, 'Broker unavailable.'));

      build();

      const alert = fixture.nativeElement.querySelector('.alert-danger');
      expect(alert?.textContent).toContain('Broker unavailable.');
    });
  });

  describe('rendered states', () => {
    it('shows an empty state instead of a blank area', () => {
      build();

      expect(fixture.nativeElement.querySelector('.alert-info')).toBeTruthy();
    });

    it('shows a spinner while the fetch is pending', () => {
      const pending = new Subject<string[]>();
      queueService.fetchAllQueueNames.and.returnValue(pending.asObservable());

      build();

      expect(fixture.nativeElement.querySelector('.spinner-border')).toBeTruthy();

      pending.next(['DLQ']);
      pending.complete();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.spinner-border')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
    });
  });
});
