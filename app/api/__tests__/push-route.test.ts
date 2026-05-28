/**
 * @jest-environment node
 */

import { DELETE, GET, POST } from "../push/route";
import { AuthError, requireSession } from "@/lib/auth";
import { getVapidPublicKey } from "@/lib/push";
import { removePushSubscription, savePushSubscription } from "@/lib/store";
import { jsonRequest, readJson } from "./route-test-utils";

jest.mock("@/lib/auth", () => {
  class MockAuthError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    AuthError: MockAuthError,
    requireSession: jest.fn(),
  };
});

jest.mock("@/lib/push", () => ({
  getVapidPublicKey: jest.fn(),
}));

jest.mock("@/lib/store", () => ({
  removePushSubscription: jest.fn(),
  savePushSubscription: jest.fn(),
  storeErrorResponse: (error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
    }
    return { status: 500, message: "RunComp could not complete that request." };
  },
}));

const session = {
  group: { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" },
  member: { id: "member-1", name: "Molly", role: "member" as const, createdAt: "2026-05-01T00:00:00Z" },
  members: [],
};

describe("/api/push", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires a signed-in session to save subscriptions", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await POST(jsonRequest("/api/push", { subscription: { endpoint: "https://push.example.test/1", keys: { p256dh: "key", auth: "auth" } } }));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it("returns the VAPID public key for browser subscription setup", async () => {
    jest.mocked(getVapidPublicKey).mockResolvedValue("public-key");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ publicKey: "public-key" });
  });

  it("saves subscriptions for the signed-in member only", async () => {
    jest.mocked(requireSession).mockResolvedValue(session as never);
    jest.mocked(savePushSubscription).mockResolvedValue({ ok: true });

    const response = await POST(jsonRequest("/api/push", { subscription: { endpoint: "https://push.example.test/1", keys: { p256dh: "key", auth: "auth" } } }));

    expect(response.status).toBe(200);
    expect(savePushSubscription).toHaveBeenCalledWith("group-1", "member-1", {
      endpoint: "https://push.example.test/1",
      keys: { p256dh: "key", auth: "auth" },
    });
    expect(await readJson(response)).toEqual({ ok: true });
  });

  it("removes subscriptions only for the signed-in member", async () => {
    jest.mocked(requireSession).mockResolvedValue(session as never);
    jest.mocked(removePushSubscription).mockResolvedValue({ removed: 1 });

    const response = await DELETE(jsonRequest("/api/push", { endpoint: "https://push.example.test/1" }, "DELETE"));

    expect(response.status).toBe(200);
    expect(removePushSubscription).toHaveBeenCalledWith("group-1", "https://push.example.test/1", "member-1");
    expect(await readJson(response)).toEqual({ ok: true });
  });

  it("requires a signed-in session before removing subscriptions", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await DELETE(jsonRequest("/api/push", { endpoint: "https://push.example.test/1" }, "DELETE"));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
    expect(removePushSubscription).not.toHaveBeenCalled();
  });
});
