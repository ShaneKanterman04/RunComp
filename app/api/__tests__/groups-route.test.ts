/**
 * @jest-environment node
 */

import { PATCH, POST } from "../groups/route";
import { AuthError, requireSession, setSessionCookie } from "@/lib/auth";
import { createGroup, getGroupContext, updateGroupGoal } from "@/lib/store";

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

function jsonRequest(body: unknown, method = "POST") {
  return new Request("http://localhost/api/groups", {
    method,
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("/api/groups", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a group, sets an owner session, and returns the full context", async () => {
    jest.mocked(createGroup).mockResolvedValue({ group, member: owner });
    jest.mocked(getGroupContext).mockResolvedValue({ group, member: owner, members: [owner] } as never);

    const response = await POST(jsonRequest({ groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: "150" }));

    expect(response.status).toBe(201);
    expect(createGroup).toHaveBeenCalledWith({ groupName: "Family Miles", ownerName: "Shane", password: "password123", goalMiles: 150 });
    expect(setSessionCookie).toHaveBeenCalledWith({ groupId: "group-1", memberId: "owner-1", role: "owner" });
    expect(await readJson(response)).toMatchObject({ authenticated: true, group: { id: "group-1" }, member: { id: "owner-1" }, members: [{ id: "owner-1" }] });
  });

  it("returns validation errors from group creation", async () => {
    jest.mocked(createGroup).mockRejectedValue({ status: 400, message: "Passwords need at least 8 characters." });

    const response = await POST(jsonRequest({ groupName: "Family Miles", ownerName: "Shane", password: "short" }));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Passwords need at least 8 characters." });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("requires owners for race goal updates", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member, members: [owner, member] } as never);

    const response = await PATCH(jsonRequest({ goalMiles: 200 }, "PATCH"));

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: "Only the group owner can update the race goal." });
    expect(updateGroupGoal).not.toHaveBeenCalled();
  });

  it("updates race goals for owners", async () => {
    jest.mocked(requireSession).mockResolvedValue({ group, member: owner, members: [owner, member] } as never);
    jest.mocked(updateGroupGoal).mockResolvedValue({ ...group, goalMiles: 200 });

    const response = await PATCH(jsonRequest({ goalMiles: "200" }, "PATCH"));

    expect(response.status).toBe(200);
    expect(updateGroupGoal).toHaveBeenCalledWith("group-1", 200);
    expect(await readJson(response)).toMatchObject({ group: { goalMiles: 200 } });
  });

  it("returns auth errors for goal updates without a valid session", async () => {
    jest.mocked(requireSession).mockRejectedValue(new AuthError("Sign in to your run group.", 401));

    const response = await PATCH(jsonRequest({ goalMiles: 200 }, "PATCH"));

    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: "Sign in to your run group." });
  });
});
