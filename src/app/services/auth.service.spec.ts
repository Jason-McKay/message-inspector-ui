import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService, LoginResponse } from './auth.service';

const LOGIN_URL = 'http://localhost:8080/api/auth/login';
const SESSION: LoginResponse = { token: 'jwt-abc', username: 'jason', roles: ['USER'] };

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token).toBeNull();
    expect(service.username).toBeNull();
    expect(service.roles).toEqual([]);
  });

  it('posts credentials and stores the session on login', () => {
    let result: LoginResponse | undefined;
    service.login('jason', 'jason').subscribe((r) => (result = r));

    const req = http.expectOne(LOGIN_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'jason', password: 'jason' });
    req.flush(SESSION);

    expect(result).toEqual(SESSION);
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.token).toBe('jwt-abc');
    expect(service.username).toBe('jason');
    expect(service.hasRole('USER')).toBeTrue();
    expect(service.hasRole('ADMIN')).toBeFalse();
  });

  it('clears the session on logout', () => {
    service.login('jason', 'jason').subscribe();
    http.expectOne(LOGIN_URL).flush(SESSION);

    service.logout();

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token).toBeNull();
  });

  // sessionStorage is what makes a refresh keep the user signed in: a getter reads it live,
  // so a session written before the service was touched is still seen.
  it('reads a pre-existing stored session', () => {
    sessionStorage.setItem('mi.auth', JSON.stringify(SESSION));

    expect(service.isAuthenticated()).toBeTrue();
    expect(service.username).toBe('jason');
    expect(service.roles).toEqual(['USER']);
  });

  it('treats a corrupt stored session as no session rather than throwing', () => {
    sessionStorage.setItem('mi.auth', 'not-json');

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.token).toBeNull();
  });
});
