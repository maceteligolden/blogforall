import { injectable } from "tsyringe";
import WaitlistModel, { WaitlistEntry } from "../../../shared/schemas/waitlist.schema";

@injectable()
export class WaitlistRepository {
  async findByEmail(email: string): Promise<WaitlistEntry | null> {
    return WaitlistModel.findOne({ email: email.toLowerCase().trim() }).lean();
  }

  async create(data: {
    email: string;
    first_name: string;
    last_name: string;
    source?: string;
  }): Promise<WaitlistEntry> {
    const doc = new WaitlistModel({
      email: data.email.toLowerCase().trim(),
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      source: data.source ?? "landing_page",
      brevo_synced: false,
    });
    return doc.save();
  }

  async updateProfile(id: string, update: { first_name: string; last_name: string }): Promise<void> {
    await WaitlistModel.findByIdAndUpdate(id, {
      first_name: update.first_name.trim(),
      last_name: update.last_name.trim(),
      updated_at: new Date(),
    });
  }

  async updateBrevoSync(
    id: string,
    update: {
      brevo_synced: boolean;
      brevo_contact_id?: number;
      brevo_sync_error?: string;
    }
  ): Promise<void> {
    await WaitlistModel.findByIdAndUpdate(id, {
      ...update,
      updated_at: new Date(),
    });
  }
}
