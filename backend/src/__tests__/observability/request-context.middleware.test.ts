import { describe, expect, it } from "@jest/globals";
import type { Request, Response } from "express";
import { requestContextMiddleware } from "../../shared/middlewares/request-context.middleware";
import { getRequestContext } from "../../shared/observability/request-context";

function createMockRes(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    getHeader: (name: string) => headers[name.toLowerCase()],
  } as unknown as Response;
}

describe("requestContextMiddleware", () => {
  it("generates requestId and sets response header", async () => {
    const req = { headers: {} } as unknown as Request;
    const res = createMockRes();
    let capturedId: string | undefined;

    await new Promise<void>((resolve) => {
      requestContextMiddleware(req, res, () => {
        capturedId = getRequestContext()?.requestId;
        resolve();
      });
    });

    expect(capturedId).toBeDefined();
    expect(res.getHeader("x-request-id")).toBe(capturedId);
  });

  it("uses incoming X-Request-Id when provided", async () => {
    const req = { headers: { "x-request-id": "incoming-id-abc" } } as unknown as Request;
    const res = createMockRes();
    let capturedId: string | undefined;

    await new Promise<void>((resolve) => {
      requestContextMiddleware(req, res, () => {
        capturedId = getRequestContext()?.requestId;
        resolve();
      });
    });

    expect(capturedId).toBe("incoming-id-abc");
    expect(res.getHeader("x-request-id")).toBe("incoming-id-abc");
  });
});
