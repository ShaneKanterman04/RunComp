/**
 * @jest-environment node
 */

import { POST } from "../invites/route";
import { AuthError, createInviteToken, requireSession } from "@/lib/auth";
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
    createInviteToken: jest.fn(),
    requireSession: jest.fn(),
  };
});

jest.mock("@/lib/store", () => ({
  storeErrorResponse: (error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
    }
    return { status: 500, message: "RunComp could not complete that request." };
  },
}));

const group = { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" };
const owner = { id: "owner-1", name: "Shane", role: "owner" as const, createdAt: "2026-05-01T00:00:00Z" };
const member = { id: "member-1", name: "Molly", role: "member" as const, createdAt: "2026-05-01T00:00:00Z" };

describe("/api/invites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires a signed-in owner", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await POST(jsonRequest("/api/invites", { memberId: "member-1" }));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
    expect(createInviteToken).not.toHaveBeenCalled();
  });

  it("rejects non-owner invite generation server-side", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member, members: [owner, member] } as never);

    const response = await POST(jsonRequest("/api/invites", { memberId: "member-1" }));

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: "Only the group owner can create login links." });
    expect(createInviteToken).not.toHaveBeenCalled();
  });

  it("only creates links for runners in the current group context", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const response = await POST(jsonRequest("/api/invites", { memberId: "other-group-member" }));

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: "Runner not found in this group." });
    expect(createInviteToken).not.toHaveBeenCalled();
  });

  it("creates a token for the selected runner and returns public member data", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);
    jest.mocked(createInviteToken).mockResolvedValue("signed-invite-token");

    const response = await POST(jsonRequest("/api/invites", { memberId: "member-1" }));

    expect(response.status).toBe(200);
    expect(createInviteToken).toHaveBeenCalledWith({ groupId: "group-1", memberId: "member-1", role: "member" });
    expect(await readJson(response)).toEqual({ token: "signed-invite-token", member });
  });
});
