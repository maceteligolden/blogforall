/** Payload for email notification job (Bull). */
export interface EmailJobPayload {
  notificationId: string;
  templateKey: string;
  recipientEmail: string;
  correlationId: string;
  params: Record<string, string>;
}
