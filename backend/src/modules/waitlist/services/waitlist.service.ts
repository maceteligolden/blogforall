import { injectable } from "tsyringe";
import { env } from "../../../shared/config/env";
import { AppError, ConflictError } from "../../../shared/errors";
import { BrevoFacade } from "../../../shared/facade/brevo.facade";
import {
  NotificationChannel,
  NotificationType,
} from "../../../shared/constants/notification.constant";
import { NotificationService } from "../../notification/services/notification.service";
import { logger } from "../../../shared/utils/logger";
import { WaitlistRepository } from "../repositories/waitlist.repository";
import { JoinWaitlistResult } from "../interfaces/waitlist.interface";

@injectable()
export class WaitlistService {
  constructor(
    private readonly waitlistRepository: WaitlistRepository,
    private readonly brevoFacade: BrevoFacade,
    private readonly notificationService: NotificationService
  ) {}

  async joinWaitlist(
    email: string,
    firstName: string,
    lastName: string,
    source = "landing_page"
  ): Promise<JoinWaitlistResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const listId = env.notification.brevoWaitlistListId;

    if (!listId) {
      throw new AppError(
        env.isDevelopment
          ? "BREVO_WAITLIST_LIST_ID is not configured. Add it to backend/.env and restart the server."
          : "Could not complete signup. Please try again.",
        502
      );
    }

    const existing = await this.waitlistRepository.findByEmail(normalizedEmail);
    if (existing?.brevo_synced) {
      throw new ConflictError("This email is already on the waitlist.");
    }

    let entry = existing;
    if (entry) {
      await this.waitlistRepository.updateProfile(String(entry._id), {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
      });
    } else {
      entry = await this.waitlistRepository.create({
        email: normalizedEmail,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        source,
      });
    }

    try {
      const { contactId } = await this.brevoFacade.createOrUpdateContact({
        email: normalizedEmail,
        listIds: [listId],
        attributes: {
          FNAME: trimmedFirstName,
          LNAME: trimmedLastName,
        },
      });

      await this.waitlistRepository.updateBrevoSync(String(entry._id), {
        brevo_synced: true,
        brevo_contact_id: contactId,
        brevo_sync_error: undefined,
      });

      this.sendConfirmationEmail(normalizedEmail, trimmedFirstName, trimmedLastName);

      return {
        email: normalizedEmail,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        brevo_synced: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Brevo contact sync failed";
      await this.waitlistRepository.updateBrevoSync(String(entry._id), {
        brevo_synced: false,
        brevo_sync_error: message,
      });
      throw new AppError("Could not complete signup. Please try again.", 502);
    }
  }

  private sendConfirmationEmail(email: string, firstName: string, lastName: string): void {
    const siteUrl = env.frontend.baseUrl;
    setImmediate(() => {
      this.notificationService
        .createAndSend({
          channel: NotificationChannel.EMAIL,
          type: NotificationType.WAITLIST_CONFIRMATION,
          recipientEmail: email,
          templateParams: { firstName, lastName, siteUrl },
        })
        .then(() => {
          logger.info("Waitlist confirmation email enqueued", { emailPrefix: email.substring(0, 3) + "***" }, "WaitlistService");
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(
            "Waitlist confirmation email failed (signup already succeeded)",
            err,
            { emailPrefix: email.substring(0, 3) + "***" },
            "WaitlistService"
          );
        });
    });
  }
}
