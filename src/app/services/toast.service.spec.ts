import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let toastr: jasmine.SpyObj<ToastrService>;

  const errorText = () => toastr.error.calls.mostRecent().args[0];

  beforeEach(() => {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', [
      'success', 'error', 'info', 'warning'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: ToastrService, useValue: toastr }
      ]
    });
    service = TestBed.inject(ToastService);
  });

  describe('apiError', () => {
    // The API sends {"success":false,"message":"..."} alongside a truthful status,
    // and its message is more specific than anything the client can invent.
    it('prefers the message the server sent', () => {
      service.apiError(
        new HttpErrorResponse({ status: 400, error: { success: false, message: 'Invalid message ID.' } }),
        'Failed to delete'
      );

      expect(errorText()).toBe('Invalid message ID.');
    });

    it('describes a broker outage when the server sends no message', () => {
      service.apiError(new HttpErrorResponse({ status: 502 }), 'Failed to delete');

      expect(errorText()).toBe('The message broker is unavailable');
    });

    it('describes a rejected request when the server sends no message', () => {
      service.apiError(new HttpErrorResponse({ status: 400 }), 'Failed to delete');

      expect(errorText()).toBe('The server rejected the request');
    });

    it('distinguishes an unreachable server from a server error', () => {
      service.apiError(new HttpErrorResponse({ status: 0 }), 'Failed to delete');

      expect(errorText()).toBe('Cannot reach the server');
    });

    it('falls back to the caller message on a plain 500', () => {
      service.apiError(new HttpErrorResponse({ status: 500 }), 'Failed to delete');

      expect(errorText()).toBe('Failed to delete');
    });

    it('falls back when the error body carries a blank message', () => {
      service.apiError(
        new HttpErrorResponse({ status: 500, error: { success: false, message: '   ' } }),
        'Failed to delete'
      );

      expect(errorText()).toBe('Failed to delete');
    });

    it('falls back when the failure is not an HTTP response at all', () => {
      service.apiError(new TypeError('boom'), 'Failed to delete');

      expect(errorText()).toBe('Failed to delete');
    });
  });
});
