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
    });

    it('reads the last-used queue from the backend, not the dev server', () => {
      service.getLastUsedQueue('jason').subscribe();

      const req = http.expectOne(`${BASE}/last-used/jason`);
      expect(req.request.method).toBe('GET');
      expect(req.request.url.startsWith('http://localhost:8080/')).toBeTrue();
      req.flush('DLQ');
    });

    it('writes the last-used queue to the backend as text/plain', () => {
      service.saveLastUsedQueue('jason', 'DLQ').subscribe();

      const req = http.expectOne(`${BASE}/last-used/jason`);
      expect(req.request.method).toBe('POST');
      // A JSON body would be stored verbatim including its quotes, per
      // QueueControllerTest.testSaveLastUsedQueue_JsonBodyIsStoredVerbatimIncludingQuotes.
      expect(req.request.headers.get('Content-Type')).toBe('text/plain');
      expect(req.request.body).toBe('DLQ');
      req.flush(null);
    });

    it('encodes the user id', () => {
      service.getLastUsedQueue('a b/c').subscribe();

      http.expectOne(`${BASE}/last-used/a%20b%2Fc`).flush('');
    });
  });

  // Absence of a preference is an empty 200; callers must not treat it as an error.
  it('returns an empty string when the user has no stored preference', () => {
    let result: string | undefined;
    service.getLastUsedQueue('nobody').subscribe((r) => (result = r));

    http.expectOne(`${BASE}/last-used/nobody`).flush('', { status: 200, statusText: 'OK' });

    expect(result).toBe('');
  });
});
