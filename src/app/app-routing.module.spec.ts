import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { routes } from './app-routing.module';

/**
 * Guards the routes the components actually navigate to.
 *
 * The component specs mock Router, which happily records a navigate() to a URL that
 * matches nothing. That is exactly how `/messages/:queueName` came to be missing while
 * every spec passed: MessageDetailComponent navigates there after a delete, a DLQ move
 * and from "Back to List", and each one failed at runtime with
 * `NG04002: Cannot match any routes` while the suite stayed green.
 */
describe('app routes', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes(routes)]
    });
    router = TestBed.inject(Router);
  });

  const itResolves = (url: string) =>
    it(`resolves ${url}`, fakeAsync(() => {
      let succeeded = false;
      router.navigateByUrl(url).then((ok) => (succeeded = ok));
      tick();

      expect(succeeded).withContext(`${url} did not match any route`).toBeTrue();
    }));

  itResolves('/messages');
  itResolves('/messages/testQueue');
  itResolves('/messages/testQueue/ID:abc-123');
  itResolves('/queues');

  it('redirects the root to the message list', fakeAsync(() => {
    router.navigateByUrl('/');
    tick();

    expect(router.url).toBe('/messages');
  }));
});
