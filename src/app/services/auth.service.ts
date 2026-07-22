import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface LoginResponse {
  token: string;
  username: string;
  roles: string[];
}

/**
 * Holds the authenticated session: the JWT bearer token and the identity it carries.
 *
 * The token lives in sessionStorage so a page refresh within the tab keeps the user signed
 * in, but it is gone when the tab closes. sessionStorage is readable by any script on the
 * page, so this is only safe because the token is short-lived (~1h server-side) and a 401
 * bounces the user back to login; the fully hardened alternative (in-memory token + a
 * refresh endpoint) is deliberately deferred.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://localhost:8080/api/auth';
  private static readonly STORAGE_KEY = 'mi.auth';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/login`, { username, password })
      .pipe(tap((session) => this.store(session)));
  }

  logout(): void {
    sessionStorage.removeItem(AuthService.STORAGE_KEY);
  }

  get token(): string | null {
    return this.session()?.token ?? null;
  }

  get username(): string | null {
    return this.session()?.username ?? null;
  }

  get roles(): string[] {
    return this.session()?.roles ?? [];
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  private store(session: LoginResponse): void {
    sessionStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(session));
  }

  private session(): LoginResponse | null {
    const raw = sessionStorage.getItem(AuthService.STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as LoginResponse;
    } catch {
      // A corrupt entry is treated as no session rather than crashing every getter.
      return null;
    }
  }
}
