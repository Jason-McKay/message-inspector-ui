export interface JmsMessage {
  messageId: string;
  payload: string;
  queueName: string;
  timestamp: string;
  properties: Record<string, string>;
}
