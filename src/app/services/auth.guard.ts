import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Blocks the app routes for anyone without a session, redirecting them to /login.
 * Returning a UrlTree rather than calling navigate() lets the Router cancel the original
 * navigation and route to /login in one step.
 */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
