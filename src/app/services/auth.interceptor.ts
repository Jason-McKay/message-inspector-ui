import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Attaches the bearer token to backend calls and turns a 401 into a bounce to /login.
 *
 * The token is only added to backend API requests (not the login call, which has no token
 * yet, and not any non-backend URL). A 401 on anything other than login means the token is
 * missing or expired, so the session is cleared and the user is sent to log in again — this
 * is what makes an expired short-lived token self-correct.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private static readonly API_PREFIX = 'http://localhost:8080/api';

  constructor(private auth: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isApiCall = req.url.startsWith(AuthInterceptor.API_PREFIX);
    const isLogin = req.url.includes('/api/auth/login');
    const token = this.auth.token;

    const authReq =
      token && isApiCall && !isLogin
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next.handle(authReq).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401 && !isLogin) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
        return throwError(() => err);
      })
    );
  }
}
