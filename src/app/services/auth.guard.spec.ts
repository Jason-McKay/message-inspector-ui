import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let isAuthenticated: boolean;
  const routerStub = {
    createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({} as UrlTree),
  };

  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

  beforeEach(() => {
    routerStub.createUrlTree.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
        { provide: Router, useValue: routerStub },
      ],
    });
  });

  it('allows an authenticated user through', () => {
    isAuthenticated = true;

    expect(run()).toBeTrue();
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated user to /login', () => {
    isAuthenticated = false;

    run();

    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
