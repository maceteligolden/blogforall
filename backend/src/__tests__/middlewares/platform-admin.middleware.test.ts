import { describe, expect, it, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import {
  requirePlatformAdmin,
  requireSuperAdmin,
} from "../../shared/middlewares/auth.middleware";
import { UserRole } from "../../shared/constants";

function mockReq(role?: string): Request {
  return {
    user: role
      ? {
          userId: "user-1",
          email: "a@test.com",
          role,
        }
      : undefined,
  } as Request;
}

describe("platform admin middleware", () => {
  it("requirePlatformAdmin rejects missing user", () => {
    const next = jest.fn() as NextFunction;
    requirePlatformAdmin(mockReq(), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as Error;
    expect(err.message).toBe("Authentication required");
  });

  it("requirePlatformAdmin rejects regular user", () => {
    const next = jest.fn() as NextFunction;
    requirePlatformAdmin(mockReq(UserRole.USER), {} as Response, next);
    const err = (next as jest.Mock).mock.calls[0][0] as Error;
    expect(err.message).toBe("Platform admin access required");
  });

  it("requirePlatformAdmin allows admin and super_admin", () => {
    const next = jest.fn() as NextFunction;
    requirePlatformAdmin(mockReq(UserRole.ADMIN), {} as Response, next);
    expect(next).toHaveBeenCalledWith();

    const next2 = jest.fn() as NextFunction;
    requirePlatformAdmin(mockReq(UserRole.SUPER_ADMIN), {} as Response, next2);
    expect(next2).toHaveBeenCalledWith();
  });

  it("requireSuperAdmin allows only super_admin", () => {
    const nextAdmin = jest.fn() as NextFunction;
    requireSuperAdmin(mockReq(UserRole.ADMIN), {} as Response, nextAdmin);
    const err = (nextAdmin as jest.Mock).mock.calls[0][0] as Error;
    expect(err.message).toBe("Super admin access required");

    const nextSuper = jest.fn() as NextFunction;
    requireSuperAdmin(mockReq(UserRole.SUPER_ADMIN), {} as Response, nextSuper);
    expect(nextSuper).toHaveBeenCalledWith();
  });
});
