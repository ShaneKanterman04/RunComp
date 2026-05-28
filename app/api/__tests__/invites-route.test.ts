/**
 * @jest-environment node
 */

import { POST } from "../invites/route";
import { AuthError, createInviteToken, requireSession } from "@/lib/auth";
import { jsonRequest, malformedJsonRequest, readJson } from "./route-test-utils";

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

  it("rejects non-object invite requests before creating tokens", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const response = await POST(jsonRequest("/api/invites", null));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON object." });
    expect(createInviteToken).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before creating tokens", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const response = await POST(malformedJsonRequest("/api/invites"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON body." });
    expect(createInviteToken).not.toHaveBeenCalled();
  });

  it("rejects missing runner ids before creating tokens", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const missing = await POST(jsonRequest("/api/invites", {}));
    const blank = await POST(jsonRequest("/api/invites", { memberId: "  " }));

    expect(missing.status).toBe(400);
    expect(await readJson(missing)).toEqual({ error: "Missing runner id." });
    expect(blank.status).toBe(400);
    expect(await readJson(blank)).toEqual({ error: "Missing runner id." });
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

  it("returns structured errors when token creation fails", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);
    jest.mocked(createInviteToken).mockRejectedValue({ status: 500, message: "RunComp could not create that login link." });

    const response = await POST(jsonRequest("/api/invites", { memberId: "member-1" }));

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({ error: "RunComp could not create that login link." });
  });
});
