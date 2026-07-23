import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {JmsMessage} from "../shared/models/jms-message.model";
import {ApiResponse} from "../shared/models/api-response.model";

/**
 * HTTP access to a queue's messages: list, view one, and the three mutating actions
 * (resend / delete / move-to-dlq). The mutating calls resolve with an {@link ApiResponse}
 * whose `success` flag is the real outcome — the backend answers HTTP 200 even on a
 * business failure, so callers must check the body, not just that `next` fired.
 *
 * Queue and message names are `encodeURIComponent`-ed here — exactly once, at the HTTP
 * boundary. Do not pre-encode upstream (see the routing note in CLAUDE.md).
 */
@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private baseUrl = 'http://localhost:8080/api/messages';

  constructor(private http: HttpClient) {}

  getMessages(queueName: string): Observable<JmsMessage[]> {
    return this.http.get<JmsMessage[]>(this.messagesUrl(queueName));
  }

  getMessage(queueName: string, messageId: string): Observable<JmsMessage> {
    return this.http.get<JmsMessage>(this.messageUrl(queueName, messageId));
  }

  resendMessage(queueName: string, messageId: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.messageUrl(queueName, messageId)}/resend`, {});
  }

  deleteMessage(queueName: string, messageId: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(this.messageUrl(queueName, messageId));
  }

  moveToDLQ(queueName: string, messageId: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.messageUrl(queueName, messageId)}/move-to-dlq`, {});
  }

  private messagesUrl(queueName: string): string {
    return `${this.baseUrl}/queue/${encodeURIComponent(queueName)}`;
  }

  private messageUrl(queueName: string, messageId: string): string {
    return `${this.messagesUrl(queueName)}/message/${encodeURIComponent(messageId)}`;
  }
}
