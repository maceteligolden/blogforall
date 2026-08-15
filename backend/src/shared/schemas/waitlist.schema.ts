import { BaseEntity } from "../interfaces";

export interface WaitlistEntry extends BaseEntity {
  email: string;
  first_name: string;
  last_name: string;
  source: string;
  brevo_synced: boolean;
  brevo_contact_id?: number;
  brevo_sync_error?: string;
}
