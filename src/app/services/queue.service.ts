import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

export interface JmsQueueDto {
  queueId: string;
  queueName: string;
  messageCount: number;
}

export interface JolokiaResponse<T> {
  request: RequestDetails;
  value: T;
  timestamp: number;
  status: number;
}

export interface RequestDetails {
  type: string;
  mbean?: string;
  attribute?: string;
}

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private baseUrl = 'http://localhost:8080/api/queues'; // Update if your backend is running elsewhere

  constructor(private http: HttpClient) {}

  getAllQueues(): Observable<JmsQueueDto[]> {
    return this.http.get<JmsQueueDto[]>(`${this.baseUrl}/artemis-straight`);
  }

  fetchAllQueues(): Observable<JmsQueueDto[]> {
    return this.http.get<JmsQueueDto[]>(`${this.baseUrl}/artemis-jolokia`);
  }

  /**
   * Returns plain queue names. Transitional: the backend historically wrapped these in
   * the Jolokia JMX envelope (names in `.value`) and is being changed to return a bare
   * array; this accepts both shapes so either side can deploy first. Collapse to a plain
   * `get<string[]>` once the backend unwrap has landed.
   */
  fetchAllQueueNames(): Observable<string[]> {
    return this.http
      .get<JolokiaResponse<string[]> | string[]>(`${this.baseUrl}/artemis-jolokia/names`)
      .pipe(map((res) => (Array.isArray(res) ? res : res?.value ?? [])));
  }

  /**
   * Returns the authenticated user's stored queue name, or an empty body when they have no
   * preference yet — absence is a 200, not a 404. The user is identified by the bearer
   * token server-side, so there is no user id to pass.
   */
  getLastUsedQueue(): Observable<string> {
    return this.http.get(this.lastUsedUrl(), { responseType: 'text' });
  }

  saveLastUsedQueue(queueName: string): Observable<void> {
    return this.http.post<void>(this.lastUsedUrl(), queueName, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  private lastUsedUrl(): string {
    return `${this.baseUrl}/last-used`;
  }
}
