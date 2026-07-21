import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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

  fetchAllQueueNames(): Observable<JolokiaResponse<string[]>> {
    return this.http.get<JolokiaResponse<string[]>>(`${this.baseUrl}/artemis-jolokia/names`);
  }

  /**
   * Returns the stored queue name, or an empty body when the user has no preference
   * yet — absence is a 200, not a 404.
   */
  getLastUsedQueue(userId: string): Observable<string> {
    return this.http.get(this.lastUsedUrl(userId), { responseType: 'text' });
  }

  saveLastUsedQueue(userId: string, queueName: string): Observable<void> {
    return this.http.post<void>(this.lastUsedUrl(userId), queueName, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  private lastUsedUrl(userId: string): string {
    return `${this.baseUrl}/last-used/${encodeURIComponent(userId)}`;
  }
}
