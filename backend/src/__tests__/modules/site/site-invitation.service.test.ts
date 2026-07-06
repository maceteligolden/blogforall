import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SiteInvitationService } from "../../../modules/site/services/site-invitation.service";
import { SiteMemberRole, InvitationStatus } from "../../../shared/constants";

jest.mock("../../../shared/schemas/user.schema", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

import User from "../../../shared/schemas/user.schema";

describe("SiteInvitationService", () => {
  let service: SiteInvitationService;
  let mockInvitationRepository: {
    findByToken: jest.Mock<any>;
    findById: jest.Mock<any>;
    findByEmail: jest.Mock<any>;
    create: jest.Mock<any>;
    updateStatus: jest.Mock<any>;
    rotateToken: jest.Mock<any>;
    findBySite: jest.Mock<any>;
  };
  let mockSiteRepository: { findById: jest.Mock<any>; isOwner: jest.Mock<any> };
  let mockSiteMemberRepository: { findBySiteAndUser: jest.Mock<any>; create: jest.Mock<any> };
  let mockUserRepository: { findByEmail: jest.Mock<any>; findById: jest.Mock<any> };
  let mockNotificationService: { createAndSend: jest.Mock<any> };
  let mockReferralService: { ensureReferralCode: jest.Mock<any> };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvitationRepository = {
      findByToken: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      rotateToken: jest.fn(),
      findBySite: jest.fn(),
    };
    mockSiteRepository = { findById: jest.fn(), isOwner: jest.fn() };
    mockSiteMemberRepository = { findBySiteAndUser: jest.fn(), create: jest.fn() };
    mockUserRepository = { findByEmail: jest.fn(), findById: jest.fn() };
    mockNotificationService = { createAndSend: jest.fn() };
    mockReferralService = { ensureReferralCode: jest.fn() };

    service = new SiteInvitationService(
      mockInvitationRepository as never,
      mockSiteRepository as never,
      mockSiteMemberRepository as never,
      mockUserRepository as never,
      mockNotificationService as never,
      mockReferralService as never
    );
  });

  describe("validateInviteForSignup", () => {
    it("returns inviter referral code when token and email match", async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        status: InvitationStatus.PENDING,
        email: "invitee@example.com",
        expires_at: new Date(Date.now() + 86400000),
        invited_by: "inviter-id",
      });
      mockReferralService.ensureReferralCode.mockResolvedValue("REFCODE1");

      const result = await service.validateInviteForSignup("token-abc", "invitee@example.com");

      expect(result.inviterReferralCode).toBe("REFCODE1");
      expect(mockReferralService.ensureReferralCode).toHaveBeenCalledWith("inviter-id");
    });

    it("rejects signup when email does not match invitation", async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        status: InvitationStatus.PENDING,
        email: "invitee@example.com",
        expires_at: new Date(Date.now() + 86400000),
        invited_by: "inviter-id",
      });

      await expect(service.validateInviteForSignup("token-abc", "other@example.com")).rejects.toThrow(
        "Signup email must match the invitation email"
      );
    });
  });

  describe("getInvitationPreview", () => {
    it("throws NotFoundError for unknown token", async () => {
      mockInvitationRepository.findByToken.mockResolvedValue(null);

      await expect(service.getInvitationPreview("missing")).rejects.toThrow("Invitation not found");
    });

    it("returns preview with requires_signup when user has no account", async () => {
      mockInvitationRepository.findByToken.mockResolvedValue({
        site_id: "site-1",
        email: "new@example.com",
        role: SiteMemberRole.EDITOR,
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 86400000),
        invited_by: "inviter-id",
      });
      mockSiteRepository.findById.mockResolvedValue({ name: "Acme Workspace" });
      (User.findById as jest.Mock<any>).mockResolvedValue({
        first_name: "Jane",
        last_name: "Doe",
      });
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const preview = await service.getInvitationPreview("token-abc");

      expect(preview.site_name).toBe("Acme Workspace");
      expect(preview.inviter_name).toBe("Jane Doe");
      expect(preview.requires_signup).toBe(true);
      expect(preview.role).toBe(SiteMemberRole.EDITOR);
    });
  });
});
