/**
 * Envelope returned by the mutating message endpoints (resend / delete / move-to-dlq).
 *
 * Note these arrive with HTTP 200 even when `success` is false — a business failure is
 * reported in the body, not the status line. Callers must check `success`; an Observable
 * `next` does not mean the operation worked.
 */
export interface ApiResponse {
  success: boolean;
  message: string;
}
