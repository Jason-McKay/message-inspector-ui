import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { noop } from 'rxjs';

import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const API_CALL = 'http://localhost:8080/api/messages/queue/DLQ';
const LOGIN_CALL = 'http://localhost:8080/api/auth/login';

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let auth: { token: string | null; logout: jasmine.Spy };

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    auth = { token: 'jwt-abc', logout: jasmine.createSpy('logout') };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the bearer token to backend API calls', () => {
    http.get(API_CALL).subscribe();

    const req = httpMock.expectOne(API_CALL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-abc');
    req.flush([]);
  });

  it('does not attach a token to the login call', () => {
    http.post(LOGIN_CALL, {}).subscribe();

    const req = httpMock.expectOne(LOGIN_CALL);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('attaches nothing when there is no token', () => {
    auth.token = null;
    http.get(API_CALL).subscribe();

    const req = httpMock.expectOne(API_CALL);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });

  it('logs out and redirects to /login on a 401', () => {
    http.get(API_CALL).subscribe({ error: noop });

    httpMock.expectOne(API_CALL).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  // A 401 from login is "wrong password", not an expired session — it must not bounce.
  it('does not redirect on a 401 from the login call itself', () => {
    http.post(LOGIN_CALL, {}).subscribe({ error: noop });

    httpMock.expectOne(LOGIN_CALL).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
