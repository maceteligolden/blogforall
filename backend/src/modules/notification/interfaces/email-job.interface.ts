/** Payload for email notification job (Bull queue). */
export interface EmailJobPayload {
  notificationId: string;
  templateKey: string;
  recipientEmail: string;
  correlationId: string;
  params: Record<string, string>;
}
