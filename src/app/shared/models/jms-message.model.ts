export interface JmsMessage {
  messageId: string;
  payload: string;
  timestamp: string;
  properties: Record<string, string>;
}
