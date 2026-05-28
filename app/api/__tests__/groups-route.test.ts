/**
 * @jest-environment node
 */

import { PATCH, POST } from "../groups/route";
import { AuthError, requireSession, setSessionCookie } from "@/lib/auth";
import { createGroup, getGroupContext, updateGroupGoal } from "@/lib/store";
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
    requireSession: jest.fn(),
    setSessionCookie: jest.fn(),
  };
});

jest.mock("@/lib/store", () => ({
  createGroup: jest.fn(),
  getGroupContext: jest.fn(),
  storeErrorResponse: (error: unknown) => {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      return { status: Number((error as { status: number }).status), message: String((error as { message: string }).message) };
    }
    return { status: 500, message: "RunComp could not complete that request." };
  },
  updateGroupGoal: jest.fn(),
}));

const group = { id: "group-1", code: "123", name: "Family Miles", goalMiles: 100, createdAt: "2026-05-01T00:00:00Z" };
const owner = { id: "owner-1", name: "Shane", role: "owner" as const, createdAt: "2026-05-01T00:00:00Z" };
const member = { id: "member-1", name: "Molly", role: "member" as const, createdAt: "2026-05-01T00:00:00Z" };

describe("/api/groups", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a group, sets an owner session, and returns the full context", async () => {
    jest.mocked(createGroup).mockResolvedValue({ group, member: owner });
    jest.mocked(getGroupContext).mockResolvedValue({ group, member: owner, members: [owner] } as never);

    const response = await POST(jsonRequest("/api/groups", { groupName: " Family Miles ", ownerName: " Shane ", password: "password123", goalMiles: "150" }));

    expect(response.status).toBe(201);
    expect(createGroup).toHaveBeenCalledWith({ groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: 150 });
    expect(setSessionCookie).toHaveBeenCalledWith({ groupId: "group-1", memberId: "owner-1", role: "owner" });
    expect(await readJson(response)).toMatchObject({ authenticated: true, group: { id: "group-1" }, member: { id: "owner-1" }, members: [{ id: "owner-1" }] });
  });

  it("falls back to the created owner when fresh group context is unavailable", async () => {
    jest.mocked(createGroup).mockResolvedValue({ group, member: owner });
    jest.mocked(getGroupContext).mockResolvedValue(null);

    const response = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane", password: "password123" }));

    expect(response.status).toBe(201);
    expect(setSessionCookie).toHaveBeenCalledWith({ groupId: "group-1", memberId: "owner-1", role: "owner" });
    expect(getGroupContext).toHaveBeenCalledWith("group-1", "owner-1");
    expect(await readJson(response)).toMatchObject({ authenticated: true, group: { id: "group-1" }, member: { id: "owner-1" }, members: [{ id: "owner-1" }] });
  });

  it("uses the default setup goal when the optional goal field is blank", async () => {
    jest.mocked(createGroup).mockResolvedValue({ group, member: owner });
    jest.mocked(getGroupContext).mockResolvedValue({ group, member: owner, members: [owner] } as never);

    const response = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: "  " }));

    expect(response.status).toBe(201);
    expect(createGroup).toHaveBeenCalledWith({ groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: 100 });
  });

  it("rejects short owner passwords before group creation", async () => {
    const response = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane", password: "short" }));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Passwords need at least 8 characters." });
    expect(createGroup).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects non-object group creation requests before store mutation", async () => {
    const response = await POST(jsonRequest("/api/groups", null));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON object." });
    expect(createGroup).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects missing setup fields before creating groups", async () => {
    const missingGroup = await POST(jsonRequest("/api/groups", { ownerName: "Shane", password: "password123" }));
    const missingOwner = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", password: "password123" }));
    const missingPassword = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane" }));
    const blankGroup = await POST(jsonRequest("/api/groups", { groupName: "  ", ownerName: "Shane", password: "password123" }));
    const blankOwner = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "  ", password: "password123" }));
    const blankPassword = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane", password: "  " }));

    expect(missingGroup.status).toBe(400);
    expect(await readJson(missingGroup)).toEqual({ error: "Group name is required." });
    expect(missingOwner.status).toBe(400);
    expect(await readJson(missingOwner)).toEqual({ error: "Owner name is required." });
    expect(missingPassword.status).toBe(400);
    expect(await readJson(missingPassword)).toEqual({ error: "Owner password is required." });
    expect(blankGroup.status).toBe(400);
    expect(await readJson(blankGroup)).toEqual({ error: "Group name is required." });
    expect(blankOwner.status).toBe(400);
    expect(await readJson(blankOwner)).toEqual({ error: "Owner name is required." });
    expect(blankPassword.status).toBe(400);
    expect(await readJson(blankPassword)).toEqual({ error: "Owner password is required." });
    expect(createGroup).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects malformed group creation JSON before store mutation", async () => {
    const response = await POST(malformedJsonRequest("/api/groups"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON body." });
    expect(createGroup).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects malformed group goal values before creating groups", async () => {
    const response = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: "many" }));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Goal miles must be a number." });
    expect(createGroup).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects out-of-range setup goals before creating groups", async () => {
    const tooSmall = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: "0" }));
    const tooLarge = await POST(jsonRequest("/api/groups", { groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: "10001" }));

    expect(tooSmall.status).toBe(400);
    expect(await readJson(tooSmall)).toEqual({ error: "Goal miles must be between 1 and 10000." });
    expect(tooLarge.status).toBe(400);
    expect(await readJson(tooLarge)).toEqual({ error: "Goal miles must be between 1 and 10000." });
    expect(createGroup).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("requires owners for race goal updates", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member, members: [owner, member] } as never);

    const response = await PATCH(jsonRequest("/api/groups", { goalMiles: 200 }, "PATCH"));

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: "Only the group owner can update the race goal." });
    expect(updateGroupGoal).not.toHaveBeenCalled();
  });

  it("updates race goals for owners", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);
    jest.mocked(updateGroupGoal).mockResolvedValue({ ...group, goalMiles: 200 });

    const response = await PATCH(jsonRequest("/api/groups", { goalMiles: "200" }, "PATCH"));

    expect(response.status).toBe(200);
    expect(updateGroupGoal).toHaveBeenCalledWith("group-1", "owner-1", 200);
    expect(await readJson(response)).toMatchObject({ group: { goalMiles: 200 } });
  });

  it("rejects out-of-range race goal updates before store mutation", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const response = await PATCH(jsonRequest("/api/groups", { goalMiles: "10001" }, "PATCH"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Goal miles must be between 1 and 10000." });
    expect(updateGroupGoal).not.toHaveBeenCalled();
  });

  it("rejects malformed race goal updates before store mutation", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const missing = await PATCH(jsonRequest("/api/groups", {}, "PATCH"));
    const blank = await PATCH(jsonRequest("/api/groups", { goalMiles: "  " }, "PATCH"));
    const malformed = await PATCH(jsonRequest("/api/groups", { goalMiles: "many" }, "PATCH"));

    expect(missing.status).toBe(400);
    expect(await readJson(missing)).toEqual({ error: "Goal miles must be a number." });
    expect(blank.status).toBe(400);
    expect(await readJson(blank)).toEqual({ error: "Goal miles must be a number." });
    expect(malformed.status).toBe(400);
    expect(await readJson(malformed)).toEqual({ error: "Goal miles must be a number." });
    expect(updateGroupGoal).not.toHaveBeenCalled();
  });

  it("rejects non-object race goal updates before store mutation", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const response = await PATCH(jsonRequest("/api/groups", null, "PATCH"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON object." });
    expect(updateGroupGoal).not.toHaveBeenCalled();
  });

  it("rejects malformed race goal JSON before store mutation", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);

    const response = await PATCH(malformedJsonRequest("/api/groups", "PATCH"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Send a JSON body." });
    expect(updateGroupGoal).not.toHaveBeenCalled();
  });

  it("returns auth errors for goal updates without a valid session", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await PATCH(jsonRequest("/api/groups", { goalMiles: 200 }, "PATCH"));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
  });
});
