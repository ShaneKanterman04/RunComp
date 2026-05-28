/**
 * @jest-environment node
 */

import { DELETE, PATCH, POST } from "../members/route";
import { AuthError, requireSession } from "@/lib/auth";
import { addMember, getGroupContext, removeInactiveMember, resetMemberPassword, updateMemberName } from "@/lib/store";

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

jest.mock("@/lib/store", () => ({
  addMember: jest.fn(),
  getGroupContext: jest.fn(),
  removeInactiveMember: jest.fn(),
  resetMemberPassword: jest.fn(),
  storeErrorResponse: (error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
    }
    return { status: 500, message: "RunComp could not complete that request." };
  },
  updateMemberName: jest.fn(),
}));

const ownerSession = {
  group: { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" },
  member: { id: "owner-1", name: "Shane", role: "owner", createdAt: "2026-05-01T00:00:00Z" },
};

const memberSession = {
  ...ownerSession,
  member: { id: "member-1", name: "Molly", role: "member", createdAt: "2026-05-01T00:00:00Z" },
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/members", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("/api/members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires a signed-in owner before creating runner passwords", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await POST(jsonRequest({ name: "Molly", password: "password123" }));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
    expect(addMember).not.toHaveBeenCalled();
  });

  it("rejects non-owner member creation server-side", async () => {
    jest.mocked(requireSession).mockResolvedValue(memberSession as never);

    const response = await POST(jsonRequest({ name: "Dad", password: "password123" }));

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: "Only the group owner can create member passwords." });
    expect(addMember).not.toHaveBeenCalled();
  });

  it("creates a member password for owners", async () => {
    jest.mocked(requireSession).mockResolvedValue(ownerSession as never);
    jest.mocked(addMember).mockResolvedValue({ id: "member-2", name: "Dad", role: "member", createdAt: "2026-05-02T00:00:00Z" });

    const response = await POST(jsonRequest({ name: "Dad", password: "password123" }));

    expect(response.status).toBe(201);
    expect(addMember).toHaveBeenCalledWith("group-1", { name: "Dad", password: "password123" });
    expect(await readJson(response)).toMatchObject({ member: { id: "member-2", name: "Dad" } });
  });

  it("updates runner names through the explicit store method", async () => {
    jest.mocked(requireSession).mockResolvedValue(ownerSession as never);
    jest.mocked(updateMemberName).mockResolvedValue({ id: "member-1", name: "Molly K", role: "member", createdAt: "2026-05-01T00:00:00Z" });
    jest.mocked(getGroupContext).mockResolvedValue({
      group: ownerSession.group,
      member: ownerSession.member,
      members: [ownerSession.member, { id: "member-1", name: "Molly K", role: "member", createdAt: "2026-05-01T00:00:00Z" }],
    } as never);

    const response = await PATCH(jsonRequest({ memberId: "member-1", name: "Molly K" }));

    expect(response.status).toBe(200);
    expect(updateMemberName).toHaveBeenCalledWith("group-1", "member-1", "Molly K");
    expect(resetMemberPassword).not.toHaveBeenCalled();
    expect(await readJson(response)).toMatchObject({ member: { name: "Molly K" }, members: [{ name: "Shane" }, { name: "Molly K" }] });
  });

  it("resets runner passwords through the explicit store method", async () => {
    jest.mocked(requireSession).mockResolvedValue(ownerSession as never);
    jest.mocked(resetMemberPassword).mockResolvedValue({ id: "member-1", name: "Molly", role: "member", createdAt: "2026-05-01T00:00:00Z" });
    jest.mocked(getGroupContext).mockResolvedValue({
      group: ownerSession.group,
      member: ownerSession.member,
      members: [ownerSession.member, { id: "member-1", name: "Molly", role: "member", createdAt: "2026-05-01T00:00:00Z" }],
    } as never);

    const response = await PATCH(jsonRequest({ memberId: "member-1", password: "newpassword" }));

    expect(response.status).toBe(200);
    expect(resetMemberPassword).toHaveBeenCalledWith("group-1", "member-1", "newpassword");
    expect(updateMemberName).not.toHaveBeenCalled();
    expect(await readJson(response)).toMatchObject({ member: { name: "Molly" } });
  });

  it("rejects non-owner runner edits and deletes", async () => {
    jest.mocked(requireSession).mockResolvedValue(memberSession as never);

    const patchResponse = await PATCH(jsonRequest({ memberId: "owner-1", name: "Not Owner" }));
    const deleteResponse = await DELETE(new Request("http://localhost/api/members?id=owner-1", { method: "DELETE" }));

    expect(patchResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(updateMemberName).not.toHaveBeenCalled();
    expect(removeInactiveMember).not.toHaveBeenCalled();
  });

  it("removes inactive runners with the owner member id as the actor", async () => {
    jest.mocked(requireSession).mockResolvedValue(ownerSession as never);
    jest.mocked(removeInactiveMember).mockResolvedValue(true);
    jest.mocked(getGroupContext).mockResolvedValue({
      group: ownerSession.group,
      member: ownerSession.member,
      members: [ownerSession.member],
    } as never);

    const response = await DELETE(new Request("http://localhost/api/members?id=member-1", { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(removeInactiveMember).toHaveBeenCalledWith("group-1", "member-1", "owner-1");
    expect(await readJson(response)).toMatchObject({ members: [{ id: "owner-1" }] });
  });
});
