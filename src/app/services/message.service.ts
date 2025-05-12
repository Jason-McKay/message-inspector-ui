import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {JmsMessage} from "../shared/models/jms-message.model";

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private baseUrl = 'http://localhost:8080/api/messages';

  constructor(private http: HttpClient) {}

  getMessages(queueName: string): Observable<JmsMessage[]> {
    return this.http.get<JmsMessage[]>(`${this.baseUrl}/queue/${encodeURIComponent(queueName)}`);
  }

  getMessage(queueName: string, messageId: string): Observable<JmsMessage> {
    return this.http.get<JmsMessage>(`${this.baseUrl}/queue/${encodeURIComponent(queueName)}/message/${messageId}`);
  }

  resendMessage(queueName: string, messageId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/queue/${encodeURIComponent(queueName)}/message/${messageId}/resend`, {});
  }

  deleteMessage(queueName: string, messageId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/queue/${encodeURIComponent(queueName)}/message/${messageId}`);
  }

  moveToDLQ(queueName: string, messageId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/queue/${encodeURIComponent(queueName)}/message/${messageId}/move-to-dlq`, {});
  }
}
