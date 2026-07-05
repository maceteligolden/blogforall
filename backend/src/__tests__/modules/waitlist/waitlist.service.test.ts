import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { WaitlistService } from "../../../modules/waitlist/services/waitlist.service";
import { WaitlistRepository } from "../../../modules/waitlist/repositories/waitlist.repository";
import { BrevoFacade } from "../../../shared/facade/brevo.facade";
import { NotificationService } from "../../../modules/notification/services/notification.service";
import { NotificationChannel, NotificationType } from "../../../shared/constants/notification.constant";

const mockFindByEmail = jest.fn<() => Promise<unknown>>();
const mockCreate = jest.fn<() => Promise<{ _id: string; email: string }>>();
const mockUpdateProfile = jest.fn<() => Promise<void>>();
const mockUpdateBrevoSync = jest.fn<() => Promise<void>>();
const mockCreateOrUpdateContact = jest.fn<() => Promise<{ contactId: number }>>();
const mockCreateAndSend = jest.fn<() => Promise<{ notificationId: string; correlationId: string }>>();

jest.mock("../../../shared/config/env", () => ({
  env: {
    isDevelopment: true,
    frontend: { baseUrl: "http://localhost:3000" },
    notification: {
      brevoWaitlistListId: 42,
    },
  },
}));

function flushSetImmediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("WaitlistService", () => {
  let service: WaitlistService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAndSend.mockResolvedValue({ notificationId: "n1", correlationId: "c1" });
    service = new WaitlistService(
      {
        findByEmail: mockFindByEmail,
        create: mockCreate,
        updateProfile: mockUpdateProfile,
        updateBrevoSync: mockUpdateBrevoSync,
      } as unknown as WaitlistRepository,
      {
        createOrUpdateContact: mockCreateOrUpdateContact,
      } as unknown as BrevoFacade,
      {
        createAndSend: mockCreateAndSend,
      } as unknown as NotificationService
    );
  });

  it("creates a waitlist entry and syncs to Brevo with names", async () => {
    mockFindByEmail.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ _id: "entry-1", email: "user@example.com" });
    mockCreateOrUpdateContact.mockResolvedValueOnce({ contactId: 99 });

    const result = await service.joinWaitlist("User@Example.com", "Jane", "Doe");

    expect(result).toEqual({
      email: "user@example.com",
      first_name: "Jane",
      last_name: "Doe",
      brevo_synced: true,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      email: "user@example.com",
      first_name: "Jane",
      last_name: "Doe",
      source: "landing_page",
    });
    expect(mockCreateOrUpdateContact).toHaveBeenCalledWith({
      email: "user@example.com",
      listIds: [42],
      attributes: { FNAME: "Jane", LNAME: "Doe" },
    });
    expect(mockUpdateBrevoSync).toHaveBeenCalledWith("entry-1", {
      brevo_synced: true,
      brevo_contact_id: 99,
      brevo_sync_error: undefined,
    });

    await flushSetImmediate();
    expect(mockCreateAndSend).toHaveBeenCalledWith({
      channel: NotificationChannel.EMAIL,
      type: NotificationType.WAITLIST_CONFIRMATION,
      recipientEmail: "user@example.com",
      templateParams: { firstName: "Jane", lastName: "Doe", siteUrl: "http://localhost:3000" },
    });
  });

  it("throws ConflictError when email already exists and is synced", async () => {
    mockFindByEmail.mockResolvedValue({ email: "user@example.com", brevo_synced: true });

    await expect(service.joinWaitlist("user@example.com", "Jane", "Doe")).rejects.toMatchObject({
      statusCode: 409,
      message: "This email is already on the waitlist.",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCreateOrUpdateContact).not.toHaveBeenCalled();
  });

  it("retries Brevo sync when email exists but was not synced", async () => {
    mockFindByEmail.mockResolvedValueOnce({
      _id: "entry-retry",
      email: "retry@example.com",
      brevo_synced: false,
    });
    mockCreateOrUpdateContact.mockResolvedValueOnce({ contactId: 55 });

    const result = await service.joinWaitlist("retry@example.com", "Alex", "Smith");

    expect(result).toEqual({
      email: "retry@example.com",
      first_name: "Alex",
      last_name: "Smith",
      brevo_synced: true,
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdateProfile).toHaveBeenCalledWith("entry-retry", {
      first_name: "Alex",
      last_name: "Smith",
    });
    expect(mockCreateOrUpdateContact).toHaveBeenCalledWith({
      email: "retry@example.com",
      listIds: [42],
      attributes: { FNAME: "Alex", LNAME: "Smith" },
    });
  });

  it("throws 502 and records sync error when Brevo fails", async () => {
    mockFindByEmail.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ _id: "entry-2", email: "fail@example.com" });
    mockCreateOrUpdateContact.mockRejectedValueOnce(new Error("Brevo unavailable"));

    await expect(service.joinWaitlist("fail@example.com", "Sam", "Lee")).rejects.toMatchObject({
      statusCode: 502,
      message: "Could not complete signup. Please try again.",
    });

    expect(mockUpdateBrevoSync).toHaveBeenCalledWith("entry-2", {
      brevo_synced: false,
      brevo_sync_error: "Brevo unavailable",
    });
    expect(mockCreateAndSend).not.toHaveBeenCalled();
  });

  it("succeeds even when confirmation email fails", async () => {
    mockFindByEmail.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValueOnce({ _id: "entry-3", email: "ok@example.com" });
    mockCreateOrUpdateContact.mockResolvedValueOnce({ contactId: 12 });
    mockCreateAndSend.mockRejectedValueOnce(new Error("Email queue down"));

    const result = await service.joinWaitlist("ok@example.com", "Chris", "Kim");

    expect(result.brevo_synced).toBe(true);
    await flushSetImmediate();
    expect(mockCreateAndSend).toHaveBeenCalled();
  });
});
