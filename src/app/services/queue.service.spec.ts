import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { QueueService } from './queue.service';

const BASE = 'http://localhost:8080/api/queues';

describe('QueueService', () => {
  let service: QueueService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [QueueService]
    });
    service = TestBed.inject(QueueService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Every call must be absolute to the backend. A relative URL resolves against the dev
  // server on :4200 instead, which is how the last-used-queue preference was silently
  // broken from Phase 1 until 2026-07-21 — it had no spec, and the browser gave no error
  // worth noticing.
  describe('URLs', () => {
    it('discovers queues on the absolute backend URLs', () => {
      service.getAllQueues().subscribe();
      http.expectOne(`${BASE}/artemis-straight`).flush([]);

      service.fetchAllQueues().subscribe();
      http.expectOne(`${BASE}/artemis-jolokia`).flush([]);

      service.fetchAllQueueNames().subscribe();
      http.expectOne(`${BASE}/artemis-jolokia/names`).flush({ value: [] });

      // The assertions here are the expectOne calls; verify() in afterEach seals them.
      expect().nothing();
    });

    // No user id in the URL any more: the backend identifies the user from the bearer
    // token, so a caller can only ever read or write its own preference.
    it('reads the last-used queue from the backend, not the dev server', () => {
      service.getLastUsedQueue().subscribe();

      const req = http.expectOne(`${BASE}/last-used`);
      expect(req.request.method).toBe('GET');
      expect(req.request.url.startsWith('http://localhost:8080/')).toBeTrue();
      req.flush('DLQ');
    });

    it('writes the last-used queue to the backend as text/plain', () => {
      service.saveLastUsedQueue('DLQ').subscribe();

      const req = http.expectOne(`${BASE}/last-used`);
      expect(req.request.method).toBe('POST');
      // A JSON body would be stored verbatim including its quotes, per
      // QueueControllerTest.testSaveLastUsedQueue_JsonBodyIsStoredVerbatimIncludingQuotes.
      expect(req.request.headers.get('Content-Type')).toBe('text/plain');
      expect(req.request.body).toBe('DLQ');
      req.flush(null);
    });
  });

  // Transitional guard for the backend's envelope unwrap: the service must deliver plain
  // names whichever shape the running backend sends, so either side can deploy first.
  // Once the backend change has landed everywhere, the envelope case (and the map shim it
  // pins) can be deleted together.
  describe('queue-name unwrapping', () => {
    it('unwraps the historical Jolokia envelope', () => {
      let result: string[] | undefined;
      service.fetchAllQueueNames().subscribe((r) => (result = r));

      http.expectOne(`${BASE}/artemis-jolokia/names`).flush({
        request: { type: 'read' },
        value: ['DLQ', 'orders.queue'],
        timestamp: 0,
        status: 200
      });

      expect(result).toEqual(['DLQ', 'orders.queue']);
    });

    it('passes a bare array straight through', () => {
      let result: string[] | undefined;
      service.fetchAllQueueNames().subscribe((r) => (result = r));

      http.expectOne(`${BASE}/artemis-jolokia/names`).flush(['DLQ', 'orders.queue']);

      expect(result).toEqual(['DLQ', 'orders.queue']);
    });
  });

  // Absence of a preference is an empty 200; callers must not treat it as an error.
  it('returns an empty string when the user has no stored preference', () => {
    let result: string | undefined;
    service.getLastUsedQueue().subscribe((r) => (result = r));

    http.expectOne(`${BASE}/last-used`).flush('', { status: 200, statusText: 'OK' });

    expect(result).toBe('');
  });
});
